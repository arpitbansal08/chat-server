// Desc: Error handler class was made to give custom error messages and status codes to the user.
class ErrorHandler extends Error{
    constructor(message,statusCode){
        super();
        this.statusCode = statusCode;
        this.message = message;
    }
}

export default ErrorHandler;