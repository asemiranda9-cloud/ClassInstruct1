// ClassInstruct AI - Gemini API Integration

// Configuration - Replace with your Gemini API key
// Note: For production, consider using a backend proxy to protect your API key
const GEMINI_API_KEY = 'AIzaSyDiHGJz_xaE3PDFotENo0csmlMdHywMVrE';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;

// Chat state
let chatHistory = [];

// DOM Elements
const chatInput = document.getElementById('chat-input');
const chatMessages = document.querySelector('.chat-messages');
const sendButton = document.querySelector('.send-btn');

// Initialize chat
document.addEventListener('DOMContentLoaded', () => {
    // Set up event listeners
    if (sendButton) {
        sendButton.addEventListener('click', handleSendMessage);
    }
    
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleSendMessage();
            }
        });
    }
});

// Handle send message
async function handleSendMessage() {
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Add user message to chat
    addMessage(message, 'user');
    chatInput.value = '';
    
    // Show loading indicator
    const loadingId = showLoading();
    
    try {
        // Get AI response
        const response = await getGeminiResponse(message);
        
        // Remove loading indicator
        removeMessage(loadingId);
        
        // Add AI response to chat
        addMessage(response, 'ai');
    } catch (error) {
        console.error('Error getting AI response:', error);
        removeMessage(loadingId);
        addMessage('Sorry, I encountered an error. Please check your API key and try again.', 'ai');
    }
}

// Get response from Gemini API
async function getGeminiResponse(prompt) {
    // Add context about ClassInstruct for better responses
    const contextPrompt = `You are ClassInstruct AI, a helpful assistant for teachers and instructors. 
You help with managing classes, students, attendance, lesson planning, and educational tasks.
User question: ${prompt}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: contextPrompt
            }]
        }],
        generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1000,
            topP: 0.95,
            topK: 40
        }
    };

    try {
        const response = await fetch(GEMINI_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'API request failed');
        }

        const data = await response.json();
        
        if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            return 'I apologize, but I could not generate a response. Please try again.';
        }
    } catch (error) {
        console.error('Gemini API Error:', error);
        throw error;
    }
}

// Add message to chat
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${sender}`;
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = 'message-avatar';
    
    if (sender === 'user') {
        avatarDiv.innerHTML = `
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
        `;
    } else {
        avatarDiv.innerHTML = `
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
        `;
    }
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('p');
    textDiv.textContent = text;
    
    const timeDiv = document.createElement('span');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    contentDiv.appendChild(textDiv);
    contentDiv.appendChild(timeDiv);
    
    messageDiv.appendChild(avatarDiv);
    messageDiv.appendChild(contentDiv);
    
    // Remove welcome message if exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    chatMessages.appendChild(messageDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Show loading indicator
function showLoading() {
    const loadingId = 'loading-' + Date.now();
    
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message message-ai';
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = `
        <div class="message-avatar">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
            </svg>
        </div>
        <div class="message-content">
            <div class="loading-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    // Remove welcome message if exists
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    chatMessages.appendChild(loadingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    return loadingId;
}

// Remove message by ID
function removeMessage(messageId) {
    const message = document.getElementById(messageId);
    if (message) {
        message.remove();
    }
}

// Get current time
function getCurrentTime() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { handleSendMessage, addMessage, getGeminiResponse };
}

