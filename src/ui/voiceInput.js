/**
 * Voice input handler - first-class voice capture
 */

class VoiceInput {
    constructor(onTranscript) {
        this.onTranscript = onTranscript;
        this.recognition = null;
        this.isRecording = false;
        this.setupRecognition();
        this.setupHotkeys();
    }

    setupRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Speech recognition not supported');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = async (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            // Process all results from the last resultIndex
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            // Update input field in real-time with interim results
            const input = document.getElementById('obligation-input');
            if (input && this.isRecording) {
                // Initialize baseText on first result
                if (this.baseText === undefined) {
                    this.baseText = input.value.trim();
                }
                
                // Combine: base text + all final transcripts + current interim transcript
                const fullText = (this.baseText + ' ' + finalTranscript + interimTranscript).trim();
                input.value = fullText;
                
                // Update baseText with final transcripts for next iteration
                if (finalTranscript.trim()) {
                    this.baseText = (this.baseText + ' ' + finalTranscript).trim();
                }
            }

            // Callback is optional - only call if provided
            if (finalTranscript.trim() && this.onTranscript) {
                await this.onTranscript(finalTranscript.trim());
            }
        };

        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                // User didn't speak, just stop
            } else {
                alert('Voice input error: ' + event.error);
            }
            this.isRecording = false;
            this.updateUI();
        };

        this.recognition.onend = () => {
            this.isRecording = false;
            this.updateUI();
            
            // Auto-submit when recording ends if there's text
            const input = document.getElementById('obligation-input');
            if (input && input.value.trim()) {
                // Trigger a custom event to submit
                const submitEvent = new CustomEvent('voiceSubmit', { 
                    detail: { text: input.value.trim() } 
                });
                document.dispatchEvent(submitEvent);
            }
            
            this.baseText = null; // Reset base text when recording ends
        };
    }

    setupHotkeys() {
        document.addEventListener('keydown', (e) => {
            // Alt+M or Cmd+M to toggle voice recording (M for microphone)
            if ((e.altKey || e.metaKey) && e.key.toLowerCase() === 'm') {
                e.preventDefault();
                this.toggleRecording();
                return;
            }

            // Ctrl+Space or Cmd+Space to toggle (alternative)
            if ((e.ctrlKey || e.metaKey) && e.key === ' ') {
                e.preventDefault();
                this.toggleRecording();
                return;
            }
        });
    }

    startRecording() {
        if (!this.recognition) {
            alert('Voice input not supported in this browser');
            return;
        }

        if (this.isRecording) {
            return;
        }

        try {
            // Store current input value as base text, or clear if empty
            const input = document.getElementById('obligation-input');
            if (input) {
                this.baseText = input.value.trim();
                if (!this.baseText) {
                    input.value = '';
                    this.baseText = '';
                }
                input.focus();
            }
            
            this.recognition.start();
            this.isRecording = true;
            this.updateUI();
            console.log('Voice recording started');
        } catch (error) {
            // Already recording or not available
            console.error('Failed to start recording:', error);
            this.isRecording = false;
            this.updateUI();
        }
    }

    stopRecording() {
        if (this.recognition && this.isRecording) {
            this.recognition.stop();
        }
    }

    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }

    updateUI() {
        const indicator = document.getElementById('voice-indicator');
        if (indicator) {
            if (this.isRecording) {
                indicator.classList.add('recording');
                indicator.textContent = '🔴';
                indicator.title = 'Recording... Press Alt+M / Cmd+M to stop';
            } else {
                indicator.classList.remove('recording');
                indicator.textContent = '🎤';
                indicator.title = 'Voice input - Press Alt+M / Cmd+M to start';
            }
        }
    }
}

