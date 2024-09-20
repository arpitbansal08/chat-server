import jwt from "jsonwebtoken";
import ErrorHandler from "../utils/utility.js";
import { User } from "../models/user.js";

const isAuthenticated = (req, res, next) => {
  const token = req.cookies.chatuToken;
  if (!token) {
    return next(new ErrorHandler("Please login to access this rout2e", 401));
  }
  const decodedData = jwt.verify(token, process.env.JWT_SECRET);
  req.user = decodedData._id;
  next();
};

const adminOnly = (req, res, next) => {
  const token = req.cookies["chatU-Admin-Token"];
  if (!token) {
    return next(
      new ErrorHandler(
        "Please login to access this route,only admin can access",
        401
      )
    );
  }
  const decodedData = jwt.verify(token, process.env.JWT_SECRET);

  if (decodedData !== process.env.ADMIN_SECRET_KEY) {
    return next(
      new ErrorHandler(
        "Not Authorized to access this route, only admin can access",
        401
      )
    );
  }
  next();
};
const socketAuthenticator = async (err, socket, next) => {
  try {
    if (err) {
      return next(err);
    }
    const authToken = socket.request.cookies.chatuToken;
    if (!authToken) {
      return next(new ErrorHandler("Please login to access this route", 401));
    }
    const decodedData = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decodedData._id);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }
    socket.user = user;
    return next();
  } catch (err) {
    console.error(err);
    return next(new ErrorHandler("Please login to access this route", 401));
  }
};

export { isAuthenticated, adminOnly, socketAuthenticator };
