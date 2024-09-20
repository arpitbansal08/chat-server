import { v2 as cloudinary } from "cloudinary";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { v4 as uuid } from "uuid";
import { corsOptions } from "./constants/config.js";
import {
  CHAT_JOINED,
  CHAT_LEFT,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  ONLINE_USERS,
  START_TYPING,
  STOP_TYPING,
} from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import { socketAuthenticator } from "./middlewares/auth.js";
import { errorMiddleware } from "./middlewares/error.js";
import { singleAvatar } from "./middlewares/multer.js";
import { Message } from "./models/message.js";
import adminRoute from "./routes/admin.js";
import chatRoute from "./routes/chat.js";
import userRoute from "./routes/user.js";
import { connectDB } from "./utils/features.js";
dotenv.config({ path: "./.env" });

const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 3000;
connectDB(MONGO_URI);
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const userSocketIDs = new Map();
const onlineUsers = new Set();

// create singlechat
// createUser(20);
// createSingleChats(10);
// createGroupChats(10);
// createMessage(100);
// createMessageInaChat(13,"6683ba9ca7284acb0c94459b");
const app = express();
const server = createServer(app);
const io = new Server(server, { cors: corsOptions });
app.set("io", io);
// Using Middlewares here
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use("/api/v1/user", singleAvatar, userRoute);
app.use("/api/v1/chat", chatRoute);
app.use("/api/v1/admin", adminRoute);

app.get("/", (req, res) => {
  res.send("Hello World");
});

io.use((socket, next) => {
  cookieParser()(socket.request, socket.request.res, async (err) => {
    await socketAuthenticator(err, socket, next);
  });
});
io.on("connection", (socket) => {
  const user = socket.user;
  userSocketIDs.set(user._id.toString(), socket.id);
  console.log("a user connected", userSocketIDs);
  // Listen for NEW_MESSAGE event
  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageForRealTime = {
      content: message,
      _id: uuid(),
      sender: {
        _id: user._id,
        name: user.name,
      },
      chat: chatId,
      createdAt: new Date().toISOString(),
    };
    console.log("emmited messagSDA APP.JS LINE 73 e", members);
    const messageForDB = {
      content: message,
      sender: user._id,
      chat: chatId,
    };
    // these are the members to whom we have to send the message( emmit is to send and on is to receive)
    const membersScoket = getSockets(members);
    io.to(membersScoket).emit(NEW_MESSAGE, {
      chatId,
      message: messageForRealTime,
    });
    io.to(membersScoket).emit(NEW_MESSAGE_ALERT, { chatId });
    try {
      await Message.create(messageForDB);
    } catch (err) {
      throw new Error(err);
    }
  });
  socket.on(START_TYPING, ({ chatId, members }) => {
    const membersScoket = getSockets(members);
    socket.to(membersScoket).emit(START_TYPING, { chatId });
  });
  socket.on(STOP_TYPING, ({ chatId, members }) => {
    const membersScoket = getSockets(members);
    socket.to(membersScoket).emit(STOP_TYPING, { chatId });
  });
  socket.on(CHAT_JOINED, ({ userId, members }) => {
    onlineUsers.add(userId.toString());
    const membersScoket = getSockets(members);
    io.to(membersScoket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });
  socket.on(CHAT_LEFT, ({ userId, members }) => {
    onlineUsers.delete(userId.toString());
    const membersScoket = getSockets(members);
    io.to(membersScoket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });
  socket.on("disconnect", () => {
    userSocketIDs.delete(user._id.toString());
    onlineUsers.delete(user._id.toString());
    socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
    console.log("user disconnected");
  });
});
app.use(errorMiddleware);
server.listen(PORT, () => {
  console.log(
    `Server is running on port ${PORT} and in ${process.env.NODE_ENV} mode`
  );
});

export { userSocketIDs };
