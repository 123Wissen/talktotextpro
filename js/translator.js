document.addEventListener('DOMContentLoaded', () => {
    const sourceText = document.getElementById('sourceText');
    const targetText = document.getElementById('targetText');
    const sourceLang = document.getElementById('sourceLang');
    const targetLang = document.getElementById('targetLang');
    const translateBtn = document.getElementById('translateBtn');
    const swapBtn = document.getElementById('swapLang');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const characterCount = document.createElement('div');
    const favoriteBtn = document.createElement('button');
    const showHistory = document.getElementById('showHistory');
    const showFavorites = document.getElementById('showFavorites');
    const historyList = document.getElementById('historyList');
    const favoritesList = document.getElementById('favoritesList');

    // MyMemory Translation API (no API key needed)
    const API_URL = 'https://api.mymemory.translated.net/get';

    // Speech Recognition Setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;

    // Speech Synthesis Setup
    const synth = window.speechSynthesis;

    let translations = JSON.parse(localStorage.getItem('translations') || '[]');

    // Add speech buttons to textareas
    function addSpeechButtons() {
        // Source speech input button
        const sourceControls = document.createElement('div');
        sourceControls.className = 'speech-controls';
        sourceControls.innerHTML = `
            <button class="btn btn-icon" id="sourceMic" title="Start speaking">
                <i class="fas fa-microphone"></i>
            </button>
        `;
        sourceText.parentElement.appendChild(sourceControls);

        // Target speech output button
        const targetControls = document.createElement('div');
        targetControls.className = 'speech-controls';
        targetControls.innerHTML = `
            <button class="btn btn-icon" id="targetSpeak" title="Listen to translation">
                <i class="fas fa-volume-up"></i>
            </button>
        `;
        targetText.parentElement.appendChild(targetControls);

        // Style for speech controls
        const style = document.createElement('style');
        style.textContent = `
            .speech-controls {
                position: absolute;
                right: 10px;
                bottom: 10px;
                display: flex;
                gap: 10px;
            }
            .btn-icon {
                padding: 8px;
                border-radius: 50%;
                background: #f5f5f5;
                border: none;
                cursor: pointer;
                transition: all 0.3s;
            }
            .btn-icon:hover {
                background: #e0e0e0;
            }
            .btn-icon.recording {
                background: #ff4444;
                color: white;
            }
            .source-lang, .target-lang {
                position: relative;
            }
        `;
        document.head.appendChild(style);
    }

    // Speech Recognition
    function setupSpeechRecognition() {
        const micBtn = document.getElementById('sourceMic');
        let isRecording = false;

        recognition.onstart = () => {
            isRecording = true;
            micBtn.classList.add('recording');
        };

        recognition.onend = () => {
            isRecording = false;
            micBtn.classList.remove('recording');
        };

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map(result => result[0].transcript)
                .join('');
            
            sourceText.value = transcript;
            if (event.results[0].isFinal && isAutoTranslateEnabled) {
                translateText();
            }
        };

        micBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            } else {
                sourceText.value = '';
                recognition.lang = sourceLang.value;
                recognition.start();
            }
        });
    }

    // Speech Synthesis
    function setupSpeechSynthesis() {
        const speakBtn = document.getElementById('targetSpeak');
        let isSpeaking = false;

        speakBtn.addEventListener('click', () => {
            if (isSpeaking) {
                synth.cancel();
                isSpeaking = false;
                speakBtn.classList.remove('speaking');
                return;
            }

            if (targetText.value) {
                const utterance = new SpeechSynthesisUtterance(targetText.value);
                utterance.lang = targetLang.value;
                
                utterance.onend = () => {
                    isSpeaking = false;
                    speakBtn.classList.remove('speaking');
                };

                synth.speak(utterance);
                isSpeaking = true;
                speakBtn.classList.add('speaking');
            }
        });
    }

    async function translateText() {
        const text = sourceText.value.trim();
        if (!text) return;

        try {
            translateBtn.disabled = true;
            translateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Translating...';

            const sourceLangCode = sourceLang.value.split('-')[0];
            const targetLangCode = targetLang.value.split('-')[0];
            
            const response = await fetch(`${API_URL}?q=${encodeURIComponent(text)}&langpair=${sourceLangCode}|${targetLangCode}`);
            const data = await response.json();

            if (data.responseStatus === 200) {
                targetText.value = data.responseData.translatedText;
                
                // Save to translation history
                saveToHistory(text, data.responseData.translatedText, sourceLang.value, targetLang.value);
            } else {
                throw new Error(data.responseDetails || 'Translation failed');
            }

        } catch (error) {
            console.error('Translation error:', error);
            const errorMessage = document.createElement('div');
            errorMessage.className = 'error-message';
            errorMessage.textContent = 'Translation failed. Please try again.';
            document.querySelector('.translator-section').appendChild(errorMessage);
            setTimeout(() => errorMessage.remove(), 3000);
        } finally {
            translateBtn.disabled = false;
            translateBtn.innerHTML = '<i class="fas fa-language"></i> Translate';
        }
    }

    // Translation History
    function saveToHistory(sourceText, translatedText, sourceLang, targetLang) {
        const history = JSON.parse(localStorage.getItem('translationHistory') || '[]');
        const historyItem = {
            sourceText,
            translatedText,
            sourceLang,
            targetLang,
            timestamp: new Date().toISOString()
        };
        history.unshift(historyItem);
        if (history.length > 10) history.pop();
        localStorage.setItem('translationHistory', JSON.stringify(history));
    }

    // Event Listeners
    translateBtn.addEventListener('click', translateText);

    // Add auto-translate toggle button
    const autoTranslateBtn = document.createElement('button');
    autoTranslateBtn.className = 'btn btn-secondary';
    autoTranslateBtn.innerHTML = '<i class="fas fa-magic"></i> Auto Translate: Off';
    autoTranslateBtn.title = 'Toggle auto translation while typing';
    
    let isAutoTranslateEnabled = false;
    let typingTimer;
    
    autoTranslateBtn.addEventListener('click', () => {
        isAutoTranslateEnabled = !isAutoTranslateEnabled;
        autoTranslateBtn.innerHTML = `<i class="fas fa-magic"></i> Auto Translate: ${isAutoTranslateEnabled ? 'On' : 'Off'}`;
        autoTranslateBtn.classList.toggle('active');
    });
    
    // Add auto-translate button to button group
    document.querySelector('.button-group').insertBefore(autoTranslateBtn, clearBtn);
    
    // Only translate automatically if enabled
    sourceText.addEventListener('input', () => {
        if (!isAutoTranslateEnabled) return;
        clearTimeout(typingTimer);
        if (sourceText.value) {
            typingTimer = setTimeout(translateText, 1000);
        }
    });

    swapBtn.addEventListener('click', () => {
        if (sourceLang.value === 'auto') return;
        
        const tempLang = sourceLang.value;
        sourceLang.value = targetLang.value;
        targetLang.value = tempLang;

        const tempText = sourceText.value;
        sourceText.value = targetText.value;
        targetText.value = tempText;
    });

    copyBtn.addEventListener('click', () => {
        if (!targetText.value) return;
        navigator.clipboard.writeText(targetText.value);
        const status = document.createElement('div');
        status.className = 'copy-status';
        status.textContent = 'Copied!';
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 2000);
    });

    // Add character counter
    function setupCharacterCounter() {
        characterCount.className = 'char-count';
        sourceText.parentElement.appendChild(characterCount);
        
        function updateCount() {
            const count = sourceText.value.length;
            const limit = 5000; // API limit
            characterCount.textContent = `${count}/${limit}`;
            characterCount.style.color = count > limit ? '#ff4444' : '#666';
        }
        
        sourceText.addEventListener('input', updateCount);
        updateCount();
    }

    // Notification helper
    function showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }

    // Initialize speech features
    addSpeechButtons();
    setupSpeechRecognition();
    setupSpeechSynthesis();
    setupCharacterCounter();

    // Clear button functionality
    clearBtn.addEventListener('click', () => {
        if (sourceText.value || targetText.value) {
            const translation = {
                id: Date.now(),
                source: sourceText.value,
                target: targetText.value,
                sourceLang: sourceLang.value,
                targetLang: targetLang.value,
                timestamp: new Date().toISOString()
            };
            
            translations.unshift(translation);
            localStorage.setItem('translations', JSON.stringify(translations));
            
            sourceText.value = '';
            targetText.value = '';
            
            updateHistoryList();
            updateCount();
            showNotification('Translation saved to history');
        }
    });

    // History toggle functionality
    document.getElementById('showHistory').addEventListener('click', () => {
        const historyList = document.getElementById('historyList');
        const showHistory = document.getElementById('showHistory');
        
        showHistory.classList.toggle('active');
        historyList.style.display = historyList.style.display === 'none' ? 'flex' : 'none';
    });

    // Update history list
    function updateHistoryList() {
        const historyList = document.getElementById('historyList');
        
        if (!translations.length) {
            historyList.innerHTML = '<p class="no-items">No history yet</p>';
            return;
        }

        historyList.innerHTML = translations.map(item => `
            <div class="history-item">
                <div class="item-header">
                    <span class="lang-pair">${getLangName(item.sourceLang)} → ${getLangName(item.targetLang)}</span>
                    <span class="timestamp">${getTimeAgo(item.timestamp)}</span>
                </div>
                <div class="item-content">
                    <p class="source-text">${item.source}</p>
                    <p class="translated-text">${item.target}</p>
                </div>
                <div class="item-actions">
                    <button class="action-btn" onclick="useTranslation(${item.id})" title="Use this translation">
                        <i class="fas fa-reply"></i>
                    </button>
                    <button class="action-btn" onclick="deleteTranslation(${item.id})" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    function getLangName(code) {
        const langSelect = document.getElementById('sourceLang');
        const option = Array.from(langSelect.options).find(opt => opt.value === code);
        return option ? option.text : code;
    }

    // Helper functions
    function getTimeAgo(timestamp) {
        const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
        if (seconds < 60) return 'just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    // Global functions for history actions
    window.useTranslation = (id) => {
        const translation = translations.find(item => item.id === id);
        if (translation) {
            sourceText.value = translation.source;
            targetText.value = translation.target;
            sourceLang.value = translation.sourceLang;
            targetLang.value = translation.targetLang;
        }
    };

    window.deleteTranslation = (id) => {
        translations = translations.filter(item => item.id !== id);
        localStorage.setItem('translations', JSON.stringify(translations));
        updateHistoryList();
        updateCount();
    };

    // Update history count
    function updateCount() {
        document.querySelector('.history-count').textContent = `(${translations.length})`;
    }

    // Clear all functionality
    document.querySelector('.clear-all-btn').addEventListener('click', () => {
        translations = [];
        localStorage.setItem('translations', JSON.stringify(translations));
        updateHistoryList();
        updateCount();
        showNotification('History cleared');
    });

    // Initialize
    updateHistoryList();
    updateCount();

    // Download functionality
    document.getElementById('downloadBtn').addEventListener('click', () => {
        if (!targetText.value) {
            showNotification('No text to download');
            return;
        }

        const text = `Source (${sourceLang.value}): ${sourceText.value}\n\nTranslation (${targetLang.value}): ${targetText.value}`;
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `translation_${new Date().toISOString().slice(0,10)}.txt`;
        document.body.appendChild(a);
        a.click();
        
        URL.revokeObjectURL(url);
        document.body.removeChild(a);
        showNotification('Translation downloaded');
    });

    // Show history by default
    document.getElementById('showHistory').click();
}); 