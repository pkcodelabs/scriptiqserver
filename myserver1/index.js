// const express = require("express");

// const app = express();
// const mongoose = require("mongoose");
// const cors = require("cors");
// const multer = require("multer");
// const { promisify } = require("util");
// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcrypt");
// const crypto = require("crypto");
// const path = require("path");
// const User = require("./models/user");
// const dotenv = require("dotenv");
// // const helmet = require("helmet");
// // const morgan = require("morgan");
// const bodyParser = require("body-parser");
// var jsonParser = bodyParser.json({
//   limit: 1024 * 1024 * 10,
//   type: "application/json",
// });
// var urlencodedParser = bodyParser.urlencoded({
//   extended: true,
//   limit: 1024 * 1024 * 10,
//   type: "application/x-www-form-urlencoded",
// });
// app.use(jsonParser);
// app.use(urlencodedParser);
// //  https://big-4bxu.onrender.com // https://future-together.onrender.com
// app.use(cors("http://localhost:5173")); //"https://big-4bxu.onrender.com"

// app.use(express.json());

// app.use("/images", express.static(path.join(__dirname, "public/Images")));
// dotenv.config({ path: "./config.env" });
// db = process.env.DATABASE_URL;
// mongoose
//   .connect(
//     db,
//     //"mongodb+srv://pavankumarmoka:3ccG3rpxQoWOGEJl@expresscluster.gfleory.mongodb.net/mydb?retryWrites=true&w=majority"
//     { useNewUrlParser: true, useUnifiedTopology: true }
//   )
//   .then(() => console.log("success"));
// // app.use(helmet());
// // app.use(morgan("common"));
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     return cb(null, "./public/Images");
//   },
//   filename: function (req, file, cb) {
//     return cb(null, `${Date.now()}_${file.originalname}`);
//   },
// });

// const upload = multer({ storage });

// app.post("/upload", upload.single("file"), (req, res) => {
//   console.log(req.body);
//   console.log(req.file);
//   res.send(req.file.filename);
// });

// const protect = async (req, res, next) => {
//   //  Getting token and check of it's there
//   let token;

//   // console.log(req.headers);
//   if (
//     req.headers.authorization &&
//     req.headers.authorization.startsWith("Bearer")
//   ) {
//     token = req.headers.authorization.split(" ")[1];
//   }
//   console.log(token);
//   if (!token) {
//     res.status(200).json({ user: "null" });
//     // const err = new AppError("You are noin taccess.", 401);
//     // return next(err);
//   }

//   // 2) Verification token
//   const decoded = await promisify(jwt.verify)(token, "secret");
//   console.log(decoded);
//   // 3) Check .lif user still exists
//   const currentUser = await User.findById(decoded.id);
//   if (!currentUser) {
//     const err = new AppError("The user no longer exist.", 400);
//     return next(err);
//   }
//   if (currentUser.changedPasswordAfter(decoded.iat)) {
//     return next(new AppError("User recently e log in again.", 401));
//   }
//   req.user = currentUser;
//   next();
// };

// const signToken = (id) => {
//   return jwt.sign({ id }, process.env.sec, {
//     expiresIn: process.env.JWT_EXPIRES_IN,
//   });
// };

// app.post("/signup", async (req, res) => {
//   const user1 = await User.create(req.body);
//   token = jwt.sign({ id: user1._id }, "secret", { expiresIn: 900 });
//   res.status(201).json({ status: "success", token, user1: { user1 } });
// });
// app.post("/login", async (req, res, next) => {
//   // try {
//   const { userId } = req.body;
//   const password = req.body.password;
//   // 1) Check if userId and password exist
//   if (!userId || !password) {
//     return next(new AppError("Please provide userId and password!", 400));
//   }
//   // 2) Check if user exists && password is correct
//   const user = await User.findOne({ userId }).select("+password");
//   // "userId":"jonfff@gh.io",
//   // "password":"1qwvertzy",
//   // const user = await User.findOne({ userId });
//   // console.log(user)
//   if (!user || !(await user.correctPassword(password, user.password))) {
//     return res.status(200).json({ user: "null" });
//     // return next(new AppError("Incorrect userId or password", 401));
//   }
//   //
//   // 3) If everything ok, send token to client
//   token = jwt.sign({ id: user._id }, "secret", { expiresIn: 900000 });
//   req.headers.authorization = token;
//   console.log(req.headers.authorization);
//   res.status(201).json({ status: "success", token, user1: { user } });

//   //   createSendToken(user, 200, res);
//   //   } catch {
//   //     res.status(201).json({ status: "fail" });
//   //   }
// });

// //
// app.listen(3001, () => {
//   console.log("Server is running");
// });

const express = require("express");
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
const { User, Story, Message } = require("./models/user");

dotenv.config({ path: "./config.env" });

const app = express();

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
app.use(cors({ origin: "*" }));

// Serve uploads folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =====================
// MongoDB Connection
// =====================

mongoose
  .connect(
    "mongodb+srv://pavankumarmoka:3ccG3rpxQoWOGEJl@expresscluster.gfleory.mongodb.net/ScriptIq?retryWrites=true&w=majority",
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err));

// =====================
// Multer Upload Config
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

// =====================
// Story Routes
// =====================

// =====================
// Story Routes
// =====================

// POST - Create story with image, rating, and script

app.post("/stories", upload.single("file"), async (req, res) => {
  try {
    const { title, script, rating } = req.body;

    const storyData = {
      title,
      script,
      rating,
      img: req.file ? `/uploads/stories/${req.file.filename}` : null,
    };

    // only set author if req.user exists
    if (req.user) {
      storyData.author = req.user._id;
    }

    const story = await Story.create(storyData);
    res.status(201).json(story);
  } catch (err) {
    console.error("Error creating story:", err);
    res.status(400).json({ message: err.message });
  }
});

// GET - Fetch all stories with author info
app.get("/stories", async (req, res) => {
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
app.post("/messages/:storyId", protect, async (req, res) => {
  try {
    const { storyId } = req.params;
    const { receiver, content } = req.body;

    const story = await Story.findById(storyId);
    if (!story) return res.status(404).json({ message: "Story not found" });

    // Only allow if rating > 0 OR story.message = true
    if (story.rating <= 0 && story.message === false) {
      return res
        .status(403)
        .json({ message: "Messaging not allowed for this story" });
    }

    const msg = await Message.create({
      story: storyId,
      sender: req.user._id,
      receiver,
      content,
    });
    res.status(201).json(msg);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

app.get("/messages/:storyId", protect, async (req, res) => {
  try {
    const { storyId } = req.params;
    const messages = await Message.find({ story: storyId })
      .sort("createdAt")
      .populate("sender receiver", "username email");
    res.status(200).json(messages);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// =====================
// Start Server
// =====================
app.listen(3001, () => {
  console.log("🚀 Server running on port 3001");
});
