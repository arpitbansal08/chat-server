import { v2 as cloudinary } from "cloudinary";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { v4 as uuid } from "uuid";
import { getBase64 } from "../lib/helper.js";
import { getSockets } from "../lib/helper.js";
const cookieOptions = {
  httpOnly: true,
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  secure: true,
};
const connectDB = (uri) => {
  mongoose
    .connect(uri, {
      dbName: "ChaTApp",
    })
    .then((data) => console.log("Connected to DB :", data.connection.host))
    .catch((err) => console.log(err));
};

const sendToken = (res, user, code, message) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
    expiresIn: "15d",
  });
  return res.status(code).cookie("chatuToken", token, cookieOptions).json({
    success: true,
    user,
    message,
  });
};

const emmitEvent = (req, event, users, data) => {
  const io = req.app.get("io");
  const userSockets = getSockets(users);
  // console.log("userSockets", userSockets);
  io.to(userSockets).emit(event, data);
};

const uploadFilesToCloudinary = async (files = []) => {
  const uploadPromises = files.map((file) => {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: "auto",
          public_id: uuid(),
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }
          resolve(result);
        }
      );
    });
  });
  try {
    const results = await Promise.all(uploadPromises);
    const formattedResults = results.map((result) => {
      return {
        public_id: result.public_id,
        url: result.secure_url,
      };
    });
    return formattedResults;
  } catch (err) {
    throw new Error("Error uploading files to cloudinary", err);
  }
};
const deleteFilesfromCloudinary = (public_id) => {
  console.log("deleteFilesfromCloudinary", public_id);
};
export {
  connectDB,
  cookieOptions,
  deleteFilesfromCloudinary,
  emmitEvent,
  sendToken,
  uploadFilesToCloudinary,
};
