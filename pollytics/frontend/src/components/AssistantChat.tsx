import { useEffect, useRef } from "react";

import type { ChatMessage, Pane } from "../utils/types";

import "./AssistantChat.css";

interface AssistantChatProps {
    electionId: number;
    electionYear: number;
    electionCountry: string;
    electionType: string;
    selectedDivisionPane: Pane | null;
    selectedRegionPane: Pane | null;
    input: string;
    messages: ChatMessage[];
    setInput: (input: string) => void;
    setMessages: (currentMessages: ChatMessage[]) => void;
}

function getNextMessageId(messages: ChatMessage[]) {
    if (!messages) {
        throw new Error("List of messages is empty.");
    }

    return messages[messages.length - 1].id + 1;
}

function getChatHeader(electionYear: number, electionCountry: string, electionType: string) {
    return (
        <div className="chat-header">
            <h1>Ask about this election</h1>
            <p>
                Explore patterns and understand the results of the
                {` ${electionYear} ${electionType} election in ${electionCountry}`}.
            </p>
        </div>
    );
}

function getChatMessagesDisplay(
    messages: ChatMessage[],
    messagesRef: React.RefObject<HTMLDivElement | null>
) {
    return (
        <div className="chat-messages" ref={messagesRef}>
            {messages.map((message) => (
                <div
                    key={message.id}
                    className={`chat-row chat-row-${message.sender}`}
                >
                    {message.sender === "assistant" && (
                        <div className="chat-avatar">P</div>
                    )}

                    <div className="chat-message">
                        {message.text}
                    </div>
                </div>
            ))}
        </div>
    );
}

function getChatSuggestions(onSelect: (input: string) => void) {
    const DISPLAYED_SUGGESTIONS_TO_ACTUAL_INPUTS = new Map<string, string>([
        ["What patterns stand out?", "What patterns stand out in these results?"],
        ["Which locations were closest?", "Which locations had the closest results?"]
    ]);

    return (
        <div className="chat-suggestions">
            {[...DISPLAYED_SUGGESTIONS_TO_ACTUAL_INPUTS.entries()].map(([display, input]) => (
                <button
                    type="button"
                    onClick={() => onSelect(input)}
                >
                    {display}
                </button>
            ))}
        </div>
    );
}

function getInputBox(
    input: string,
    handleSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void,
    onChange: (event: React.ChangeEvent<HTMLInputElement, HTMLInputElement>) => void
) {
    return (
        <form
            className="chat-form"
            onSubmit={handleSubmit}
        >
            <input
                value={input}
                onChange={onChange}
                placeholder="Type your question here..."
                aria-label="Input box for the user to ask about the election results"
            />

            {/* The submit button cannot be clicked when the input is empty */}
            <button type="submit" disabled={!input.trim()}>
                Send
            </button>
        </form>
    );   
}

function AssistantChat({ 
    electionId,
    electionYear,
    electionCountry,
    electionType,
    selectedDivisionPane,
    selectedRegionPane,
    input,
    messages,
    setInput,
    setMessages
}: AssistantChatProps) {
    const messagesRef = useRef<HTMLDivElement>(null);

    // Every time the message list is set, we jump to the bottom of the message display
    useEffect(() => {
        const messagesContainer = messagesRef.current;

        if (!messagesContainer) {
            throw new Error("Chat container is null but the page is on the assistant chat tab");
        }

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, [messages]);

    function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();

        // Remove whitespace in submitted message
        const trimmedInput = input.trim();

        if (!trimmedInput) {
            return;
        }

        // Display user's message
        const newUserMessage: ChatMessage = {
            id: getNextMessageId(messages),
            sender: "user",
            text: trimmedInput
        };
        setMessages([...messages, newUserMessage]);
        setInput("");

        // Display assistant's message
        // Temporary response until backend is connected
        const newAssistantMessage: ChatMessage = {
            id: getNextMessageId(messages),
            sender: "assistant",
            text: "I will analyse that using the election data.",
        }
        setTimeout(() => {
            setMessages([...messages, newUserMessage, newAssistantMessage]);
        }, 500);
    }

    return (
        <section className="chat">
            {getChatHeader(electionYear, electionCountry, electionType)}
            {getChatMessagesDisplay(messages, messagesRef)}
            {getChatSuggestions(setInput)}
            {getInputBox(input, handleSubmit, (event) => setInput(event.target.value))}
        </section>
    );
}

export default AssistantChat;