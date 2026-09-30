import "./ErrorMessage.css";

interface ErrorMessageProps {
    msg: string;
}

function ErrorMessage({ msg }: ErrorMessageProps) {
    return (
        <div className="error-message">
            <h2>Something went wrong...</h2>
            <p>{msg}</p>
        </div>
    );
}

export default ErrorMessage;