const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// =====================
// User Schema
// =====================
const UserSchema = new mongoose.Schema(
  {
    userId: { type: String, required: false, unique: true },
    username: { type: String, required: true, trim: true, unique: true },
    email: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: { type: String, required: true, minlength: 6, select: false },
    desc: { type: String, max: 500 },
    country: { type: String },
    star: { type: String },
    state: { type: String },

    pincode: { type: Number, default: 0 },
    img: { type: String },
    role: {
      type: String,
      enum: ["user", "admin", "employee"],
      default: "user",
    },
    passwordChangedAt: Date,
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// =====================
// Story Schema
// =====================
const StorySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    title: { type: String, required: true, trim: true },
    script: { type: String, required: true },
    genre: {
      type: String,
      enum: [
        "Action",
        "Drama",
        "Comedy",
        "Thriller",
        "Romance",
        "Horror",
        "Sci-Fi",
        "Fantasy",
        "Animation",
        "Documentary",
      ],
      required: true,
    },
    rating: { type: Number, default: 0 },
    message: { type: Boolean, default: false },
    category: { type: String, default: "uncategorized" },
    img: { type: String }, // Poster / cover image
    status: {
      type: String,
      enum: ["draft", "submitted", "approved", "rejected"],
      default: "draft",
    },
  },
  { timestamps: true }
);

// =====================
// Message Schema
// =====================
const MessageSchema = new mongoose.Schema(
  {
    story: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    content: { type: String, required: true, trim: true },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const paymentSchema = new mongoose.Schema(
  {
    storyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
      required: true,
    },
    title: { type: String, required: true },
    from: { type: String, required: true },
    rating: { type: Number, required: true },

    // Fixed info
    amount: { type: Number, default: 100 },
    paymentMethod: { type: String, default: "Razorpay" },
    purpose: { type: String, default: "Story Submission Fee" },
    authorisedBy: { type: String, default: "Pavan Kumar" },

    logoUrl: { type: String, default: "images/scriptiqlogo2.png" },
    storyImg: { type: String, default: "images/scriptiqlogo1.jpg" },

    email: { type: String, default: "scriptiq.support@company.com" },
    phone: { type: String, default: "+91-9876543210" },
    companyName: { type: String, default: "SCRIPT IQ" },

    receiptId: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// =====================
// Export Models
// =====================
module.exports = {
  Payment: mongoose.model("Payment", paymentSchema),
  User: mongoose.model("User", UserSchema),
  Message: mongoose.model("Message", MessageSchema),
  Story: mongoose.model("Story", StorySchema),
};
