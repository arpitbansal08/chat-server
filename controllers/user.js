import { compare } from "bcrypt";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";
import { User } from "../models/user.js";
import {
  cookieOptions,
  emmitEvent,
  sendToken,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import ErrorHandler from "../utils/utility.js";
import { getOtherMember } from "../lib/helper.js";
// Create new user and save to database and save token in cookie
const newUser = async (req, res, next) => {
  try {
    const { name, username, password, bio } = req.body;
    const file = req.file;
    if (!file) {
      return next(new ErrorHandler("Please upload an avatar", 400));
    }

    const result = await uploadFilesToCloudinary([file]);
    console.log("result", result);
    const avatar = {
      public_id: result[0].public_id,
      url: result[0].url,
    };
    const user = await User.create({
      name,
      bio,
      username,
      password,
      avatar,
    });
    // Send token in cookie and save cookie with token
    sendToken(res, user, 201, "User created");
  } catch (err) {
    next(new ErrorHandler(err, 500));
  }
};

const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username }).select("+password");
    if (!user) {
      return next(new ErrorHandler("Invalid Username or Password", 404));
    }

    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return next(new ErrorHandler("Invalid Password", 404));
    } else {
      sendToken(res, user, 200, `User logged in , Welcome ${user.name}`);
    }
  } catch (err) {
    console.log("Rer", err);
    next(new ErrorHandler(err.message, 500));
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user).select("-password");
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (err) {
    console.log("dsd");
    next(new ErrorHandler(err.message, 500));
  }
};

const logout = (req, res) => {
  res
    .status(200)
    .cookie("chatuToken", "", { ...cookieOptions, maxAge: 0 })
    .json({
      success: true,
      message: "Logged out Successfully",
    });
};

//pending -> done
const searchUser = async (req, res, next) => {
  try {
    const { name = "" } = req.query;
    const myChats = await Chat.find({ groupChat: false, members: req.user });
    // Get all users from myChats and flat the array means friends or users with whom I have chatted
    const allUsersFromMyChats = myChats.map((chat) => chat.members).flat();
    // All users except my friends or users with whom I have chatted
    const allUsersExceptMeandFriends = await User.find({
      _id: { $nin: allUsersFromMyChats },
      name: { $regex: name, $options: "i" }, // option i -> case insensitive
    });
    // Modifying the response
    const users = allUsersExceptMeandFriends.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));
    const a = req.user;
    users.splice(
      users.findIndex((user) => user._id.toString() === a),
      1
    );
    return res.status(200).json({
      success: true,
      users,
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const sendFreindRequest = async (req, res, next) => {
  try {
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }
    const request = await Request.findOne({
      $or: [
        { sender: req.user, receiver: userId },
        { sender: userId, receiver: req.user },
      ],
    });
    if (request) {
      return next(new ErrorHandler("Request already sent", 400));
    }
    await Request.create({
      sender: req.user,
      receiver: userId,
    });
    emmitEvent(req, NEW_REQUEST, [userId]);
    return res.status(200).json({
      success: true,
      message: "Friend Request sent",
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const acceptFriendRequest = async (req, res, next) => {
  try {
    const { requestId, accept } = req.body;
    const request = await Request.findById(requestId)
      .populate("sender", "name")
      .populate("receiver", "name");
    if (!request) {
      return next(new ErrorHandler("Request not found", 404));
    }
    if (request.receiver._id.toString() !== req.user.toString()) {
      return next(
        new ErrorHandler("You are not authorized to accept this request", 401)
      );
    }
    if (!accept) {
      await request.deleteOne();
      return res.status(200).json({
        success: true,
        message: "Request removed",
      });
    }
    const members = [request.sender._id, request.receiver._id];
    await Promise.all([
      Chat.create({
        members,
        groupChat: false,
        name: `${request.sender.name} - ${request.receiver.name}`,
      }),
      request.deleteOne(),
    ]);
    emmitEvent(req, REFETCH_CHATS, members);
    return res.status(200).json({
      success: true,
      message: "Request accepted",
      senderId: request.sender._id,
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};

const getMyNotifications = async (req, res, next) => {
  try {
    const requests = await Request.find({ receiver: req.user }).populate(
      "sender",
      "name avatar"
    );
    const allRequests = requests.map(({ _id, sender }) => ({
      _id,
      sender: { _id: sender._id, name: sender.name, avatar: sender.avatar.url },
    }));
    return res.status(200).json({
      success: true,
      requests: allRequests,
    });
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};
const getMyFriends = async (req, res, next) => {
  try {
    const { chatId } = req.query;
    const chat = await Chat.find({
      groupChat: false,
      members: req.user,
    }).populate("members", "name avatar");
    const friends = chat.map(({ members }) => {
      const otherMember = getOtherMember(members, req.user);
      return {
        _id: otherMember._id,
        name: otherMember.name,
        avatar: otherMember.avatar.url,
      };
    });
    if (chatId) {
      const chat = await Chat.findById(chatId);
      // Get all friends except the members of the chat so that i can add them to the chat
      // Basically I can add friends to the chat who are not already in the chat
      const availableFriends = friends.filter(
        (friend) => !chat.members.includes(friend._id)
      );
      return res.status(200).json({
        success: true,
        friends: availableFriends,
      });
    } else {
      return res.status(200).json({
        success: true,
        friends,
      });
    }
  } catch (err) {
    next(new ErrorHandler(err.message, 500));
  }
};
export {
  getMyFriends,
  acceptFriendRequest,
  getMyNotifications,
  getMyProfile,
  login,
  logout,
  newUser,
  searchUser,
  sendFreindRequest,
};
