export type IpcResponse<Send extends object> =
    <Message extends Extract<keyof Send, string>>(message: Message, data: Send[Message]) => void;
