const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const multer = require("multer");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const path = require("path");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const fs = require("fs");

// Import models
const { User, Story, Message, Payment } = require("./models/user");

dotenv.config({ path: "./config.env" });

const app = express();
const server = http.createServer(app);

// =====================
// Middleware
// =====================
app.use(
  bodyParser.json({
    limit: "10mb",
    type: "application/json",
  })
);
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "10mb",
    type: "application/x-www-form-urlencoded",
  })
);
// app.use(cors({ origin: "*" }));
//app.use(cors({ origin: "https://scriptiq-ehqm.onrender.com" }));
app.use(
  cors({
    origin: ["https://scriptiq-ehqm.onrender.com", "http://localhost:5173"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    credentials: true, // Allow cookies/auth headers
  })
);

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =====================
// MongoDB
// =====================
mongoose
  .connect(
    "mongodb+srv://pavankumarmoka:3ccG3rpxQoWOGEJl@expresscluster.gfleory.mongodb.net/ScriptIq?retryWrites=true&w=majority",
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// =====================
// Multer Upload
// =====================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const folder = "uploads/stories";
    if (!fs.existsSync(folder)) fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique filename
  },
});
const upload = multer({ storage });

// =====================
// JWT Helpers
// =====================
const protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return res.status(401).json({ message: "Not authorized" });

  try {
    const decoded = await promisify(jwt.verify)(token, process.env.SECRET);
    const currentUser = await User.findById(decoded.id);
    if (!currentUser)
      return res.status(401).json({ message: "User not found" });

    if (currentUser.changedPasswordAfter(decoded.iat)) {
      return res
        .status(401)
        .json({ message: "Password recently changed. Please log in again." });
    }
    req.user = currentUser;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

const signToken = (id) => {
  return jwt.sign({ id }, process.env.SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
};

// =====================
// Auth Routes
// =====================
app.post("/signup", async (req, res) => {
  try {
    const user = await User.create(req.body);
    const token = signToken(user._id);
    res.status(201).json({ status: "success", token, user });
  } catch (err) {
    res.status(400).json({ status: "fail", message: err.message });
  }
});

app.post("/login", async (req, res) => {
  const { userId, password } = req.body;
  if (!userId || !password) {
    return res
      .status(400)
      .json({ message: "Please provide userId and password" });
  }

  const user = await User.findOne({ userId }).select("+password");
  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({ message: "Incorrect userId or password" });
  }

  const token = signToken(user._id);
  res.status(200).json({ status: "success", token, user });
});

app.post("/auth/google", async (req, res) => {
  try {
    const { email, username, img } = req.body;

    // Check if user already exists
    let user = await User.findOne({ email });

    if (!user) {
      // Create a new user without password
      user = await User.create({
        userId: email.split("@")[0], // simple fallback userId
        username,
        email,
        password: Math.random().toString(36).slice(-8), // random password (hashed by pre-save hook)
        img,
      });
    }

    // Sign token
    const token = signToken(user._id);

    res.status(200).json({
      status: "success",
      token,
      user,
    });
  } catch (err) {
    res.status(400).json({ status: "fail", message: err.message });
  }
});
app.post("/callme", protect, async (req, res) => {
  try {
    // You don’t need to send email from frontend, we already have req.user from token
    res.status(200).json({
      status: "success",
      message: "Token verified successfully!",
      user: req.user, // return user details
    });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/stories", protect, upload.single("file"), async (req, res) => {
  try {
    const { title, script, rating, genre } = req.body;

    const storyData = {
      title,
      genre,
      script,
      rating,
      img: req.file ? `/uploads/stories/${req.file.filename}` : null,
      author: req.user._id, // ✅ logged-in user
    };

    const story = await Story.create(storyData);

    // ✅ populate author before sending
    const populated = await story.populate("author", "username email");

    res.status(201).json(populated);
  } catch (err) {
    console.error("Error creating story:", err);
    res.status(400).json({ message: err.message });
  }
});

app.get("/stories", protect, async (req, res) => {
  try {
    const stories = await Story.find()
      .populate("author", "username email")
      .select("title script rating img author createdAt");
    res.status(200).json(stories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// =====================
// Message Routes
// =====================
// POST /messages/:storyId
app.post("/messages/:storyId", protect, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { content } = req.body;

    // Check story
    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ message: "Story not found" });
    }

    // Only allow if rating > 0 OR story.message = true
    if (story.rating > 0 && story.message === false) {
      return res
        .status(403)
        .json({ message: "Messaging not allowed for this story" });
    }

    // Create message
    let message = await Message.create({
      story: storyId,
      sender: req.user._id, // from protect middleware
      content,
    });

    // Populate sender (important for frontend)
    message = await message.populate("sender", "username email");

    // Optionally: broadcast via socket.io so all clients get it
    // io.to(storyId).emit("message", message);

    res.status(201).json(message);
  } catch (err) {
    console.error("❌ Message save error:", err);
    res.status(400).json({ message: err.message });
  }
});

app.get("/messages/:storyId", protect, async (req, res) => {
  try {
    const { storyId } = req.params;
    const messages = await Message.find({ story: storyId })
      .sort("createdAt")
      .populate("sender", "username email");
    res.status(200).json(messages);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});
// =====================
// Example: allowed admin emails
// =====================
const adminEmails = ["rith8596@gmail.com", "superadmin@example.com"];

// =====================
// Admin: Create Employee/User
// =====================
app.post("/employee/create", protect, async (req, res) => {
  try {
    const { username, email, password, role, country, state, pincode, star } =
      req.body;
    console.log(req.user.email, "eeeeeeeeeeeeee");
    console.log(
      role === "employee" && !adminEmails.includes(req.user.email),
      "eeeeeeeeeeeeee"
    );
    // ✅ Ensure only admin emails can create employees
    if (role === "employee" && !adminEmails.includes(req.user.email)) {
      return res
        .status(403)
        .json({ message: "Only admins can create employees" });
    }

    // ✅ Ensure email uniqueness
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "Email already exists" });
    }

    // ✅ Create user
    const newUser = await User.create({
      username,
      email,
      password,
      role,
      country,
      state,
      pincode,
      star,
    });

    res.status(201).json({
      status: "success",
      message: "User created successfully",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err) {
    console.error("❌ Error creating user:", err);
    res.status(400).json({ message: err.message });
  }
});

// POST - create payment

app.post("/paid", async (req, res) => {
  try {
    const { storyId, receiptId, from, storyImg, title, rating } = req.body;

    // Create new payment
    const newPayment = new Payment({
      storyId,
      title,
      from,
      storyImg,
      rating,
      receiptId,
    });

    // Save payment
    const savedPayment = await newPayment.save();
    res.status(201).json(savedPayment);
  } catch (err) {
    console.error("❌ Error creating payment:", err);
    res.status(500).json({ message: "Failed to create payment" });
  }
});

// GET - get all payments
app.get("/paid", async (req, res) => {
  try {
    const payments = await Payment.find().sort({ date: -1 });
    res.status(200).json(payments);
  } catch (err) {
    console.error("❌ Error fetching payments:", err);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
});

// GET - get single payment by receiptId
app.get("/paid/:receiptId", async (req, res) => {
  try {
    const payment = await Payment.findOne({ receiptId: req.params.receiptId });
    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.status(200).json(payment);
  } catch (err) {
    console.error("❌ Error fetching payment:", err);
    res.status(500).json({ message: "Failed to fetch payment" });
  }
});

// =====================
// SOCKET.IO SETUP
// =====================
// const io = new Server(server, {
//   cors: {
//     origin: ["https://scriptiq-ehqm.onrender.com"],
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });
const io = new Server(server, {
  cors: {
    origin: [
      "https://scriptiq-ehqm.onrender.com",
      "http://localhost:5173",
      "https://accounter-ajdb.onrender.com",
    ],
    methods: ["GET", "POST", "PUT"],
    credentials: true,
  },
});
let onlineUsers = [];
const addNewUser = (userId, socketId) => {
  !onlineUsers.some((u) => u.userId === userId) &&
    onlineUsers.push({ userId, socketId });
};
const removeUser = (socketId) => {
  onlineUsers = onlineUsers.filter((u) => u.socketId !== socketId);
};
const getUser = (userId) => onlineUsers.find((u) => u.userId === userId);

io.on("connection", (socket) => {
  console.log("⚡ New connection:", socket.id);

  // join story room
  socket.on("joinRoom", async ({ storyId, user }) => {
    try {
      const story = await Story.findById(storyId);
      if (!story) {
        return socket.emit("error", { message: "Story not found" });
      }
      console.log(story.author, "socket story data");

      const isCreator = story?.author?.toString() === user.id?.toString();

      console.log("userid", user.id);
      console.log(isCreator, user.role);
      const isEmployee = user.role === "employee";
      const isAdmin = user.role === "admin";

      if (socket.rooms.has(storyId)) {
        socket.emit("error", { message: "Already joined this room" });
        return;
      }

      if (isCreator || isEmployee || isAdmin) {
        socket.join(storyId);
        addNewUser(user.id, socket.id);

        console.log(`✅ ${user.name} joined room ${storyId}`);
        socket.emit("joined", { room: storyId });
        // io.to(storyId).emit("message", {
        //   text: `${user.name} joined the chat.`,
        //   user: { id: "system", name: "System" },
        //   storyId,
        //   time: new Date(),
        // });
        socket.broadcast.to(storyId).emit("message", {
          text: `${user.name} joined the chat.`,
          user: { id: "system", name: "System" },
          storyId,
          time: new Date(),
        });
      } else {
        socket.emit("error", { message: "Not allowed to join this room" });
        socket.disconnect();
      }
    } catch (err) {
      console.error(err);
      socket.emit("error", { message: "Server error" });
    }
  });

  // chat messages
  socket.on("message", (msg) => {
    console.log(msg);
    console.log("💬 Message:", msg);
    io.to(msg.storyId).emit("message", msg);
  });

  // disconnect
  socket.on("disconnect", () => {
    removeUser(socket.id);
    console.log("❌ Disconnected:", socket.id);
  });
});

// =====================
// START SERVER
// =====================
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
