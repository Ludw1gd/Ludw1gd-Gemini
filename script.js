const messageForm = document.querySelector('.prompt__form');
const chatHistoryContainer = document.querySelector('.chats');
const suggestionItems = document.querySelectorAll('.suggests__item');

const themeToggleButton = document.getElementById('themeToggler');
const clearChatButton = document.getElementById('deleteButton');

// state variables
let currentUserMessage = null;
let isGeneratingResponse = false;

const GOOGLE_API_KEY = "AIzaSyB_lfg2FnzwjRIR2GkyOxLLiVG8B_Qfi8U";
const API_REQUEST_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`;

// load saved chat history
const loadSavedChatHistory = () => {
    const savedConversations = JSON.parse(localStorage.getItem('saved-api-chats')) || [];
    const isLightTheme = localStorage.getItem('themeColor') === 'light_mode';

    document.body.classList.toggle('light_mode', isLightTheme);
    themeToggleButton.innerHTML = isLightTheme ? '<i class="bx bx-moon" ></i>' : '<i class="bx bx-sun" ></i>';

    chatHistoryContainer.innerHTML = '';

    // iterate through saved conversations and render them
    savedConversations.forEach(conversation => {
        // display user message
        const userMessageHtml = `

            <div class="message__content">
                <img class="message__avatar" src="assets/Profile.jpeg" alt="User Avatar">
                <p class="message__text">${conversation.userMessage}</p>
            </div>
            
        `;

        const outgoingMessageElement = createChatMessageElement(userMessageHtml, "message--outgoing");
        chatHistoryContainer.appendChild(outgoingMessageElement);

        // display api response
        const responseText = conversation.apiResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsedApiResponse = marked.parse(responseText); // convert markdown to html
        const rawApiResponse = responseText; // plain text response

        const responseHtml = `

            <div class="message__content">
                <img class="message__avatar" src="assets/gemini.svg" alt="Gemini Avatar">
                <p class="message__text"></p>
                <div class="message__loading-indicator hide">
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                    <div class="message__loading-bar"></div>
                </div>
            </div>
            <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>

        `;

        const incomingMessageElement = createChatMessageElement(responseHtml, "message--incoming");
        chatHistoryContainer.appendChild(incomingMessageElement);

        const messageTextElement = incomingMessageElement.querySelector('.message__text');

        // display saved chat without typing animation
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement, true); // 'true' skips typing animation
    });
    document.body.classList.toggle("hide-header", savedConversations.length > 0);
};

// create a new chat message element
const createChatMessageElement = (htmlContent, ...cssClasses) => {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', ...cssClasses);
    messageElement.innerHTML = htmlContent;
    return messageElement;
};

// show typing effect
const showTypingEffect = (rawText, htmlText, messageElement, incomingMessageElement, skipEffect = false) => {
    const copyIconElement = incomingMessageElement.querySelector('.message__icon');
    copyIconElement.classList.add("hide"); // initially hide copy button

    if (skipEffect) {
        // display message without typing effect
        messageElement.innerHTML = htmlText;
        hljs.highlightAll();
        addCopyButtonToCodeBlocks();
        copyIconElement.classList.remove("hide"); // show copy button
        isGeneratingResponse = false;
        return;
    }

    const wordsArray = rawText.split(' ');
    let wordIndex = 0;
    const typingInterval = setInterval(() => {
        messageElement.innerText += (wordIndex === 0 ? '' : ' ') + wordsArray[wordIndex++];

        if(wordIndex === wordsArray.length) {
            clearInterval(typingInterval);
            isGeneratingResponse = false;
            messageElement.innerHTML = htmlText;
            hljs.highlightAll();
            addCopyButtonToCodeBlocks();
            copyIconElement.classList.remove("hide"); // show copy button
        }
    }, 75);
};

// fetch api response based on user message
const requestApiResponse = async (incomingMessageElement) => {
    const messageTextElement = incomingMessageElement.querySelector('.message__text');

    try {
        const response = await fetch(API_REQUEST_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: currentUserMessage }]
                }]
            })
        })

        const responseData = await response.json();
        if (!response.ok) {
            throw new Error(responseData.error.message);
        }

        const responseText = responseData?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error('No response from API');
        }

        const parsedApiResponse = marked.parse(responseText); // convert markdown to html
        const rawApiResponse = responseText; // plain text response
        showTypingEffect(rawApiResponse, parsedApiResponse, messageTextElement, incomingMessageElement);

        // save chat history in local storage
        let savedConversations = JSON.parse(localStorage.getItem('saved-api-chats')) || [];
        savedConversations.push({
            userMessage: currentUserMessage,
            apiResponse: responseData
        });
        localStorage.setItem("saved-api-chats", JSON.stringify(savedConversations));
    }

    catch (error) {
        isGeneratingResponse = false;
        messageTextElement.innerText = error.message;
        messageTextElement.closest('.message').classList.add('message--error');
    }

    finally {
        incomingMessageElement.classList.remove("message--loading");
    }
};

// add copy button to code blocks 
const addCopyButtonToCodeBlocks = () => {
    const codeBlocks = document.querySelectorAll('pre');
    codeBlocks.forEach((block) => {
        const codeElement = block.querySelector('code');
        let language = [...codeElement.classList].find(cls => cls.startsWith('language-'))?.replace('language-', '') || 'Text'; // get language from class name

        const languageLabel = document.createElement('div'); // create language label
        languageLabel.innerText = language.charAt(0).toUpperCase() + language.slice(1); // capitalize first letter
        languageLabel.classList.add('code__language-label'); // add class to label
        block.appendChild(languageLabel); // append label to block

        const copyButton = document.createElement('button');
        copyButton.innerHTML = `<i class='bx bx-copy'></i>`; // copy icon
        copyButton.classList.add('code__copy-btn'); // add class to button
        block.appendChild(copyButton);

        copyButton.addEventListener('click', () => {
            navigator.clipboard.writeText(codeElement.innerText).then(() => {
                copyButton.innerHTML = `<i class='bx bx-check'></i>`; // check icon
                setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy'></i>`, 2000); // revert to copy icon after 2 seconds
            }).catch (err => {
                console.error("Copy failed:", err);
                alert("Unable to copy text!");
            });
        });
    });
};

// show loading animation while waiting for api response
const displayLoadingAnimation = () => {
    const loadingHtml = `
        
        <div class="message__content">
            <img class="message__avatar" src="assets/gemini.svg" alt="Gemini Avatar">
            <p class="message__text"></p>
            <div class="message__loading-indicator">
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
                <div class="message__loading-bar"></div>
            </div>
        </div>
        <span onClick="copyMessageToClipboard(this)" class="message__icon hide"><i class='bx bx-copy-alt'></i></span>

    `;

    const loadingMessageElement = createChatMessageElement(loadingHtml, "message--incoming", "message--loading");
    chatHistoryContainer.appendChild(loadingMessageElement);
    requestApiResponse(loadingMessageElement);
};

// copy message to clipboard
const copyMessageToClipboard = (copyButton) => {
    const messageContent = copyButton.parentElement.querySelector(".message__text").innerText;
    navigator.clipboard.writeText(messageContent);
    copyButton.innerHTML = `<i class='bx bx-check'></i>`; // confirmation icon
    setTimeout(() => copyButton.innerHTML = `<i class='bx bx-copy-alt'></i>`, 1000); // revert to copy icon after 1 second
};

// handle sending chat message
const handleOutGoingMessage = () => {
    currentUserMessage = messageForm.querySelector(".prompt__form-input").value.trim() || currentUserMessage;

    if (!currentUserMessage || isGeneratingResponse) return; // ignore empty messages
    isGeneratingResponse = true;

    const outgoingMessageHtml = `

        <div class="message__content">
            <img class="message__avatar" src="assets/Profile.jpeg" alt="User Avatar">
            <p class="message__text"></p>
        </div>
        
    `;

    const outgoingMessageElement = createChatMessageElement(outgoingMessageHtml, "message--outgoing");
    outgoingMessageElement.querySelector(".message__text").innerText = currentUserMessage; // display user message
    chatHistoryContainer.appendChild(outgoingMessageElement);
    messageForm.reset(); // clear input field
    document.body.classList.add("hide-header"); // hide header on chat start
    setTimeout(displayLoadingAnimation, 500); // show loading animation after 500ms
};

// toggle between light and dark theme
themeToggleButton.addEventListener('click', () => {
    const isLightTheme = document.body.classList.toggle("light_mode");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode");

    // update icon based on theme
    const newIconClass = isLightTheme ? "bx bx-moon" : "bx bx-sun";
    themeToggleButton.querySelector("i").className = newIconClass;
});

// clear all chat history
clearChatButton.addEventListener('click', () => {
    if (confirm("Are you sure you want to delete all chat history?")) {
        localStorage.removeItem("saved-api-chats");
        
        // reload chat history after clearing
        loadSavedChatHistory();
        currentUserMessage = null;
        isGeneratingResponse = false;  
    }
});

// handle click on suggestion items
suggestionItems.forEach(suggestion => {
    suggestion.addEventListener('click', () => {
        currentUserMessage = suggestion.querySelector(".suggests__item-text").innerText;
        handleOutGoingMessage();
    });
});

// prevent default form submission and handle outgoing message
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleOutGoingMessage();;
});

// load saved chat history on page load
loadSavedChatHistory();
