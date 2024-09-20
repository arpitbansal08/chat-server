import { Chat } from "../models/chat.js";
import { Message } from "../models/message.js";
import { User } from "../models/user.js";
import ErrorHandler from "../utils/utility.js";
import jwt from "jsonwebtoken";
import { cookieOptions } from "../utils/features.js";

const adminLogin = async (req, res, next) => {
  const { secretKey } = req.body;
  const isMatch = secretKey === process.env.ADMIN_SECRET_KEY;
  if (!isMatch) {
    return next(new ErrorHandler("Invalid Secret Key", 401));
  }
  const token = jwt.sign(secretKey, process.env.JWT_SECRET);

  return res
    .status(200)
    .cookie("chatU-Admin-Token", token, {
      ...cookieOptions,
      maxAge: 1000 * 15 * 60,
    })
    .json({
      success: true,
      message: "Authenticated Successfully,Welcome Boss!",
    });
};

const adminLogout = async (req, res, next) => {
  return res
    .status(200)
    .cookie("chatU-Admin-Token", "", { ...cookieOptions, maxAge: 0 })
    .json({ success: true, message: "Admin Logged Out Successfully" });
};
const allUsers = async (req, res, next) => {
  try {
    const users = await User.find();
    const transformedUsers = await Promise.all(
      users.map(async (user) => {
        const [groups, friends] = await Promise.all([
          Chat.countDocuments({ groupChat: true, members: user._id }),
          Chat.countDocuments({ groupChat: false, members: user._id }),
        ]);
        return {
          _id: user._id,
          name: user.name,
          username: user.username,
          avatar: user.avatar.url,
          groups,
          friends,
        };
      })
    );
    return res.status(200).json({
      success: true,
      users: transformedUsers,
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};
const allChats = async (req, res, next) => {
  try {
    const chats = await Chat.find()
      .populate("members", "name avatar")
      .populate("creator", "name avatar");
    // here we are creating transformedChats array by mapping over chats array where we are spreading the
    //   also avatar only 4 memebrs as per frontend created
    //    members array and then we are returning the transformed object with the required fields
    const transformedChats = await Promise.all(
      chats.map(async ({ members, _id, groupChat, name, creator }) => {
        const totalMessages = await Message.countDocuments({ chat: _id });
        return {
          _id,
          name,
          groupChat,
          creator: {
            name: creator?.name || "NONE",
            avatar: creator?.avatar.url || "nONE",
          },
          members: members.map(({ _id, name, avatar }) => ({
            _id,
            name,
            avatar: avatar.url,
          })),
          avatar: members.slice(0, 4).map(({ avatar }) => avatar.url),
          totalMembers: members.length,
          totalMessages,
        };
      })
    );
    return res.status(200).json({
      success: true,
      chats: transformedChats,
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};
const allMessages = async (req, res, next) => {
  try {
    const messages = await Message.find()
      .populate("sender", "name avatar")
      .populate("chat", "groupChat");
    const transformedMessages = messages.map(
      ({ sender, attachments, content, _id, chat, createdAt }) => {
        return {
          _id,
          createdAt,
          attachments,
          content,
          sender: {
            _id: sender._id,
            name: sender.name,
            avatar: sender.avatar.url,
          },
          chat: chat._id,
          groupChat: chat.groupChat,
        };
      }
    );

    return res.status(200).json({
      success: true,
      messages: transformedMessages,
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const [usersCount, chatsCount, messagesCount, totalChatsCount] =
      await Promise.all([
        User.countDocuments(),
        Chat.countDocuments({ groupChat: true }),
        Message.countDocuments(),
        Chat.countDocuments(),
      ]);
    const today = new Date();
    const lastSevenDays = new Date();
    lastSevenDays.setDate(today.getDate() - 7);
    const lastSevenDaysMessages = await Message.find({
      createdAt: { $gte: lastSevenDays, $lte: today },
    }).select("createdAt");
    const messages = new Array(7).fill(0);
    const dayInMs = 1000 * 24 * 60 * 60;
    lastSevenDaysMessages.forEach((message) => {
      const indexApprox =
        (today.getTime() - message.createdAt.getTime()) / dayInMs;
      const index = Math.floor(indexApprox);
      messages[6 - index]++;
    });
    const stats = {
      usersCount,
      chatsCount,
      messagesCount,
      totalChatsCount,
      messagesChart: messages,
    };
    return res
      .status(200)
      .json({ success: true, message: "Dashboard stats", stats });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};
const getAdminData = async (req, res, next) => {
  try {
    return res.status(200).json({ admin: true });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};
export {
  adminLogout,
  allChats,
  allMessages,
  allUsers,
  getDashboardStats,
  adminLogin,
  getAdminData,
};
