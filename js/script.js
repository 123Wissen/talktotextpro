document.addEventListener('DOMContentLoaded', () => {
    // Constants
    const MESSAGES = {
        START_RECORDING: 'Recording started...',
        STOP_RECORDING: 'Recording stopped',
        COPY_SUCCESS: 'Text copied to clipboard',
        COPY_ERROR: 'Failed to copy text',
        DOWNLOAD_SUCCESS: 'Text downloaded successfully',
        DOWNLOAD_ERROR: 'Failed to download file',
        SHARE_SUCCESS: 'Text shared successfully',
        SHARE_ERROR: 'Failed to share text',
        CLEAR_SUCCESS: 'Text cleared',
        BROWSER_NOT_SUPPORTED: 'Your browser does not support this feature'
    };

    const MAX_HISTORY_ITEMS = 50; // Maximum history items to store
    const MAX_TEXT_LENGTH = 1000; // Maximum characters per history item

    // Elements
    const startBtn = document.getElementById('startBtn');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const shareBtn = document.getElementById('shareBtn');
    const output = document.getElementById('output');
    const status = document.getElementById('status');
    const wordCount = document.getElementById('wordCount');
    const charCount = document.getElementById('charCount');
    const languageSelect = document.getElementById('languageSelect');
    
    // History elements
    const toggleHistoryBtn = document.getElementById('toggleHistory');
    const clearHistoryBtn = document.getElementById('clearHistory');
    const historyList = document.getElementById('historyList');

    // Variables
    let isRecording = false;
    let history = JSON.parse(localStorage.getItem('speechHistory') || '[]');
    let isHistoryVisible = true;

    // Speech Recognition setup
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showStatus(MESSAGES.BROWSER_NOT_SUPPORTED, 'error');
        return;
    }
    
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.lang = languageSelect.value;

    // Add variable to store complete conversation
    let completeTranscript = '';
    let lastProcessedIndex = 0;

    // Event Listeners
    startBtn?.addEventListener('click', toggleRecording);
    copyBtn?.addEventListener('click', () => {
        if (!output.value.trim()) {
            alert('No text to copy!');
            return;
        }
        navigator.clipboard.writeText(output.value)
            .then(() => {
                showStatus('Text copied to clipboard!');
            })
            .catch(err => {
                showStatus('Failed to copy text: ' + err);
            });
    });
    clearBtn?.addEventListener('click', clearText);
    downloadBtn?.addEventListener('click', () => {
        if (!output.value.trim()) {
            alert('No text to download!');
            return;
        }
        const blob = new Blob([output.value], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'speech-to-text.txt';
        a.click();
        window.URL.revokeObjectURL(url);
    });
    shareBtn?.addEventListener('click', async () => {
        if (!output.value.trim()) {
            alert('No text to share!');
            return;
        }
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Speech to Text Conversion',
                    text: output.value
                });
                showStatus('Text shared successfully!');
            } catch (err) {
                showStatus('Error sharing text: ' + err);
            }
        } else {
            showStatus('Web Share API not supported');
        }
    });
    languageSelect?.addEventListener('change', () => {
        recognition.lang = languageSelect.value;
        recognition.stop();
        if (isRecording) {
            recognition.start();
        }
    });
    toggleHistoryBtn?.addEventListener('click', () => {
        isHistoryVisible = !isHistoryVisible;
        historyList.classList.toggle('hidden');
        
        // Update button text
        toggleHistoryBtn.innerHTML = isHistoryVisible ? 
            '<i class="fas fa-clock"></i><span>Hide History</span>' : 
            '<i class="fas fa-clock"></i><span>Show History</span>';
    });
    clearHistoryBtn?.addEventListener('click', clearHistory);

    // Main Functions
    function toggleRecording() {
        try {
            showLoading(true);
            if (!isRecording) {
                // Start new recording
                completeTranscript = '';  // Reset complete transcript
                lastProcessedIndex = 0;   // Reset processed index
                output.value = '';        // Clear display
                recognition.start();
                startBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Recording';
                startBtn.classList.add('recording');
                showStatus(MESSAGES.START_RECORDING, 'info');
            } else {
                recognition.stop();
                startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
                startBtn.classList.remove('recording');
                showStatus(MESSAGES.STOP_RECORDING, 'info');
            }
            isRecording = !isRecording;
        } catch (error) {
            handleError(error);
        } finally {
            showLoading(false);
        }
    }

    function clearText() {
        output.value = '';
        updateCounts();
        showStatus(MESSAGES.CLEAR_SUCCESS, 'info');
    }

    // Speech Recognition Events
    recognition.onresult = (event) => {
        let interimTranscript = '';
        
        // Process all new results since last processed index
        for (let i = lastProcessedIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            
            if (result.isFinal) {
                completeTranscript += ' ' + transcript;
                lastProcessedIndex = i + 1;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // Show complete transcript plus any interim results
        output.value = (completeTranscript + ' ' + interimTranscript).trim();
        updateCounts();
    };

    recognition.onerror = (event) => {
        handleError(event.error, 'Speech recognition error occurred');
        isRecording = false;
        startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
        startBtn.classList.remove('recording');
    };

    recognition.onend = () => {
        if (isRecording) {
            // If still recording but recognition ended, restart it immediately
            try {
                recognition.start();
            } catch (error) {
                console.error('Failed to restart recognition:', error);
                // Only stop recording if there's a critical error
                if (error.name === 'NotAllowedError') {
                    isRecording = false;
                    startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
                    startBtn.classList.remove('recording');
                    showStatus('Microphone access denied', 'error');
                } else {
                    // For other errors, try to restart after a short delay
                    setTimeout(() => {
                        try {
                            recognition.start();
                        } catch (retryError) {
                            console.error('Failed to restart after delay:', retryError);
                            isRecording = false;
                            startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
                            startBtn.classList.remove('recording');
                        }
                    }, 100);
                }
            }
        } else {
            // Only update UI if actually stopping
            startBtn.innerHTML = '<i class="fas fa-microphone"></i> Start Recording';
            startBtn.classList.remove('recording');
            showStatus(MESSAGES.STOP_RECORDING, 'info');

            // Save to history only when explicitly stopped and there is text
            if (completeTranscript.trim()) {
                const historyItem = {
                    text: completeTranscript.trim(),
                    language: languageSelect.options[languageSelect.selectedIndex].text,
                    date: new Date().toLocaleString()
                };
                
                const history = JSON.parse(localStorage.getItem('speechHistory') || '[]');
                history.unshift(historyItem);
                if (history.length > 10) history.pop();
                localStorage.setItem('speechHistory', JSON.stringify(history));
                updateHistoryDisplay();
            }
        }
    };

    // History Functions
    function clearHistory() {
        history = [];
        localStorage.removeItem('speechHistory');
        updateHistoryDisplay();
        showStatus('History cleared', 'info');
    }

    function updateHistoryDisplay() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        const history = JSON.parse(localStorage.getItem('speechHistory') || '[]');
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="history-item">No history available</div>';
            return;
        }
        
        historyList.innerHTML = history.map(item => `
            <div class="history-item" onclick="document.getElementById('output').value='${item.text}'; updateCounts();">
                <div class="history-text">${item.text}</div>
                <div class="history-meta">
                    <span>${item.language}</span>
                    <span>${item.date}</span>
                </div>
            </div>
        `).join('');
    }

    // Add auto-cleanup for old history items
    function cleanupOldHistory() {
        const ONE_MONTH = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
        const now = new Date().getTime();

        history = history.filter(item => {
            const itemDate = new Date(item.date).getTime();
            return (now - itemDate) < ONE_MONTH;
        });

        localStorage.setItem('speechHistory', JSON.stringify(history));
        updateHistoryDisplay();
    }

    // Run cleanup on startup
    cleanupOldHistory();

    // Run cleanup every day
    setInterval(cleanupOldHistory, 24 * 60 * 60 * 1000);

    // Utility Functions
    function updateCounts() {
        const text = output.value.trim();
        let words = 0;
        let chars = 0;
        
        if (text) {
            // Count words (handling multiple spaces and special characters)
            words = text.split(/\s+/).filter(word => word.length > 0).length;
            // Count characters (including spaces)
            chars = output.value.length;
        }
        
        wordCount.textContent = words;
        charCount.textContent = chars;
    }

    // Add event listener for textarea changes
    output.addEventListener('input', updateCounts);

    // Update counts when text is cleared
    function clearText() {
        output.value = '';
        updateCounts();
        showStatus(MESSAGES.CLEAR_SUCCESS, 'info');
    }

    // Update counts when text is pasted
    output.addEventListener('paste', () => {
        setTimeout(updateCounts, 0);
    });

    // Update counts when history item is clicked
    function setOutputText(text) {
        output.value = text;
        updateCounts();
    }

    function showStatus(message, type = 'info') {
        if (status) {
            status.textContent = message;
            status.className = `status-message ${type}`;
        }
    }

    function handleError(error, message) {
        console.error(error);
        showStatus(message || 'An error occurred', 'error');
    }

    function showLoading(show) {
        const loader = document.getElementById('loadingIndicator');
        if (loader) {
            loader.style.display = show ? 'flex' : 'none';
        }
    }

    // Initial setup
    updateHistoryDisplay();
}); 