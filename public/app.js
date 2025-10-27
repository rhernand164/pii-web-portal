// --- Configuration for Celery Backend ---
// Use a placeholder that will be replaced by envsubst during container startup
const API_BASE_URL = '${API_BASE_URL}'; // CORRECTED Placeholder format
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.txt'];
const FILE_TYPE_MAP = {
    '.csv': 'csv',
    '.xlsx': 'xlsx',
    '.xls': 'xls',
    '.txt': 'txt'
};

// --- State Management ---
let selectedFile = null;
let selectedFileType = null;
let selectedSanitizeMode = 'nlp'; // Default to FAST mode
let pollInterval = null;

// --- DOM Elements ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileTypeSection = document.getElementById('fileTypeSection');
const fileTypeSelect = document.getElementById('fileTypeSelect');
const fileTypeWarning = document.getElementById('fileTypeWarning');
const sanitizeModeSection = document.getElementById('sanitizeModeSection');
const sanitizeModeSelect = document.getElementById('sanitizeModeSelect');
const sanitizeBtn = document.getElementById('sanitizeBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const statusBox = document.getElementById('statusBox');
const statusText = document.getElementById('statusText');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const closeError = document.getElementById('closeError');
const downloadSection = document.getElementById('downloadSection');
const downloadBtn = document.getElementById('downloadBtn');
const sanitizeAnotherBtn = document.getElementById('sanitizeAnotherBtn');
const cancelBtn = document.getElementById('cancelBtn');
const llmWarningModal = document.getElementById('llmWarningModal');
const confirmLlmMode = document.getElementById('confirmLlmMode');
const cancelLlmMode = document.getElementById('cancelLlmMode');

// --- Initialization ---
function init() {
    setupEventListeners();
    // Optional: Check if already authenticated on page load
    // checkInitialAuth();
}

function setupEventListeners() {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileTypeSelect.addEventListener('change', handleFileTypeChange);
    sanitizeModeSelect.addEventListener('change', handleSanitizeModeChange);
    sanitizeBtn.addEventListener('click', handleSanitize);
    if (cancelBtn) cancelBtn.addEventListener('click', handleCancel);
    closeError.addEventListener('click', () => hideModal(errorModal));
    if (sanitizeAnotherBtn) sanitizeAnotherBtn.addEventListener('click', resetForm);
    if (confirmLlmMode) confirmLlmMode.addEventListener('click', handleConfirmLlmMode);
    if (cancelLlmMode) cancelLlmMode.addEventListener('click', handleCancelLlmMode);

    // Setup About modal listeners
    const aboutBtn = document.getElementById('aboutBtn');
    const aboutModal = document.getElementById('aboutModal');
    const closeAbout = document.getElementById('closeAbout');
    if (aboutBtn && aboutModal && closeAbout) {
        aboutBtn.addEventListener('click', () => showModal(aboutModal));
        closeAbout.addEventListener('click', () => hideModal(aboutModal));
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) hideModal(aboutModal);
        });
    }
    // Setup Feedback button listener
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/1LqvkXzuh5EVk-IQGraHmV2qX5orvB47mjYMTHbn5zOU/preview', '_blank');
        });
    }
}

// --- Drag and Drop / File Selection Handlers ---
function handleDragOver(e) { e.preventDefault(); dropZone.classList.add('drag-over'); }
function handleDragLeave(e) { e.preventDefault(); dropZone.classList.remove('drag-over'); }
function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
}
function handleFileSelect(e) {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
}

function handleFile(file) {
    const validation = validateFile(file);
    if (!validation.valid) {
        showError(validation.message);
        return;
    }
    if (downloadSection) downloadSection.style.display = 'none';
    selectedFile = file;
    fileName.textContent = file.name;
    fileInfo.style.display = 'block';
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const detectedType = FILE_TYPE_MAP[fileExt] || '';
    fileTypeSection.style.display = 'block';
    sanitizeModeSection.style.display = 'block';
    fileTypeSelect.value = detectedType;
    selectedFileType = detectedType;
    fileTypeWarning.style.display = 'none';
    sanitizeBtn.disabled = !selectedFileType;
    statusBox.style.display = 'block';
    updateStatus('STATUS: Select file type to continue', 'default');
}

function handleFileTypeChange(e) {
    selectedFileType = e.target.value;
    if (!selectedFileType) {
        sanitizeBtn.disabled = true;
        fileTypeWarning.style.display = 'none';
        updateStatus('Please select a file type', 'default');
        return;
    }
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    const detectedType = FILE_TYPE_MAP[fileExt];
    const isXlsxMatch = (fileExt === '.xlsx' && (selectedFileType === 'xlsx' || selectedFileType === 'xlsx_generic'));
    if (selectedFileType !== detectedType && !isXlsxMatch) {
        fileTypeWarning.style.display = 'block';
        fileTypeWarning.textContent = `⚠️ Warning: Selected type "${selectedFileType.toUpperCase()}" doesn't match file extension "${fileExt}"`;
    } else {
        fileTypeWarning.style.display = 'none';
    }
    sanitizeBtn.disabled = false;
    updateStatus('File ready to sanitize', 'default');
}

function handleSanitizeModeChange(e) {
    const newMode = e.target.value;
    if (newMode === 'nlp_llm') {
        showModal(llmWarningModal);
    } else {
        selectedSanitizeMode = newMode;
    }
}

function handleConfirmLlmMode() {
    selectedSanitizeMode = 'nlp_llm';
    sanitizeModeSelect.value = 'nlp_llm';
    hideModal(llmWarningModal);
}

function handleCancelLlmMode() {
    sanitizeModeSelect.value = 'nlp';
    selectedSanitizeMode = 'nlp';
    hideModal(llmWarningModal);
}

function validateFile(file) {
    if (file.size > MAX_FILE_SIZE) return { valid: false, message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) return { valid: false, message: `Unsupported file type. Please upload CSV, XLSX, XLS, or TXT files` };
    return { valid: true };
}

// --- API Interaction & Authentication Handling ---

/**
 * Handles responses, checking for 401 Unauthorized and redirecting if needed.
 * @param {Response} response - The Fetch API Response object.
 * @param {string} operationDesc - Description of the operation for error messages.
 * @returns {Promise<object|null>} - Resolves with parsed JSON data or null if redirected. Rejects on other errors.
 */
async function handleApiResponse(response, operationDesc) {
    if (response.status === 401) {
        console.warn(`${operationDesc} failed: 401 Unauthorized.`);
        updateStatus('STATUS: Authentication required', 'error');
        try {
            const data = await response.json();
            if (data && data.login_url) {
                console.log(`Redirecting to login URL: ${data.login_url}`);
                // Redirect the browser to the login page provided by the backend
                window.location.href = data.login_url;
                return null; // Indicate redirection happened
            } else {
                // 401 but no login URL - show generic error
                throw new Error('Authentication required, but no login URL provided by the server.');
            }
        } catch (jsonError) {
            // Failed to parse JSON body from 401 response
            console.error('Failed to parse 401 response body:', jsonError);
            throw new Error('Authentication required. Please log in.');
        }
    }

    if (!response.ok) {
        // Handle other non-401 errors
        let errorData;
        try {
            errorData = await response.json();
        } catch (e) {
            errorData = { error: `Server error: ${response.status} ${response.statusText}` };
        }
        console.error(`${operationDesc} failed:`, errorData);
        throw new Error(errorData.error || `Server error: ${response.status}`);
    }

    // --- Response Handling for different content types ---
    const contentType = response.headers.get("content-type");

    // Handle JSON responses (like status checks, job submission success)
    if (contentType && contentType.indexOf("application/json") !== -1) {
        try {
            return await response.json();
        } catch (e) {
            console.error('Failed to parse successful JSON response:', e);
            throw new Error('Received an invalid JSON response from the server.');
        }
    }
    // Handle Blob responses (like file downloads)
    else if (response.ok && response.status !== 204) { // 204 No Content has no body
        try {
            // For file downloads, we often need the blob and headers, not JSON
             return {
                blob: await response.blob(),
                headers: response.headers
             };
        } catch (e) {
            console.error('Failed to get blob from successful response:', e);
            throw new Error('Received an invalid file response from the server.');
        }
    }
     // Handle empty successful responses (like 204 No Content)
    else if (response.ok) {
         return {}; // Return empty object or null as appropriate
    }
    // Fallback for unexpected content types or errors already thrown
    else {
        // Error should have been thrown by previous checks, but added for safety
        throw new Error(`Unexpected response status: ${response.status}`);
    }
}


async function handleSanitize() {
    if (!selectedFile || !selectedFileType) {
        showError('Please select a file type before sanitizing');
        return;
    }
    if (downloadSection) downloadSection.style.display = 'none';

    setProcessingState(true);
    updateStatus('STATUS: Submitting job...', 'processing');

    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('file_type', selectedFileType);
    formData.append('use_llm', selectedSanitizeMode === 'nlp_llm');

    try {
        const response = await fetch(`${API_BASE_URL}/sanitize_csv`, {
            method: 'POST',
            body: formData,
            // Credentials 'include' is needed to SEND cookies to the backend
            credentials: 'include'
        });

        const data = await handleApiResponse(response, 'Sanitization submission');

        // If handleApiResponse returned null, it means a redirect happened. Stop processing.
        if (data === null) return;

        if (data && data.job_id) {
            pollStatus(data.job_id);
        } else {
            // Handle case where response was OK but didn't contain job_id
            throw new Error('Server response did not include a valid job ID.');
        }

    } catch (error) {
        // Errors thrown by handleApiResponse or fetch itself are caught here
        console.error('Sanitization submission error:', error);
        updateStatus('STATUS: Job submission failed', 'error');
        showError(error.message || 'An error occurred during job submission.');
        setProcessingState(false);
    }
}

function pollStatus(jobId) {
    updateStatus('STATUS: Job queued. Waiting for worker...', 'processing');

    // Clear any previous interval just in case
    if (pollInterval) clearInterval(pollInterval);

    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/status/${jobId}`, {
                // Credentials 'include' is needed to SEND cookies to the backend
                credentials: 'include'
            });

            // Use handleApiResponse to check for 401 and handle errors
            const data = await handleApiResponse(response, `Polling status for job ${jobId}`);

            // If redirect happened, clear interval and stop
            if (data === null) {
                clearInterval(pollInterval);
                pollInterval = null;
                setProcessingState(false); // Reset button state
                return;
            }

            // Process valid status data
            if (data.state === 'PROGRESS') {
                updateStatus(`STATUS: ${data.status || 'Processing...'}`, 'processing');
            } else if (data.state === 'PENDING') {
                updateStatus('STATUS: Job is pending...', 'processing');
            }

            if (data.state === 'SUCCESS' || data.state === 'FAILURE') {
                clearInterval(pollInterval);
                pollInterval = null;
                setProcessingState(false);

                if (data.state === 'SUCCESS') {
                    updateStatus('STATUS: Sanitization complete!', 'success');
                    showDownloadLink(jobId);
                } else {
                    const errorMsg = data.error || 'The job failed for an unknown reason.';
                    updateStatus('STATUS: Sanitization failed', 'error');
                    showError(errorMsg);
                }
            }
        } catch (error) {
            // Errors from handleApiResponse or fetch are caught here
            console.error('Polling Error:', error);
            clearInterval(pollInterval);
            pollInterval = null;
            updateStatus('STATUS: Connection lost or Auth Error', 'error');
            // Avoid showing login URL here as it might loop if auth fails repeatedly
            showError(error.message || 'Failed to get job status. Please check network or try logging in again.');
            setProcessingState(false);
        }
    }, 3000); // Poll every 3 seconds
}


function showDownloadLink(jobId) {
    if (downloadSection) {
        // The /result endpoint triggers a file download via Content-Disposition header
        // Browser navigation handles this correctly, including sending cookies.
        const resultUrl = `${API_BASE_URL}/result/${jobId}`;
        const downloadNote = document.getElementById('downloadNote');

        if (['xlsx', 'xls', 'xlsx_generic'].includes(selectedFileType)) {
            downloadNote.textContent = 'Note: Multi-sheet Excel files are returned as a single .xlsx file with each sanitized sheet as a separate tab.';
        } else {
            downloadNote.textContent = '';
        }

        // --- Simplified Download ---
        // Clicking the button simply navigates the browser to the result URL
        downloadBtn.onclick = () => {
             console.log(`Attempting download from: ${resultUrl}`);
             window.location.href = resultUrl;
        };
        // --- End Simplified Download ---

        downloadSection.style.display = 'block';
        downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


function handleCancel() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        updateStatus('STATUS: Aborted by user', 'default');
        setProcessingState(false);
    }
}

function setProcessingState(isProcessing) {
    sanitizeBtn.disabled = isProcessing;
    if (isProcessing) {
        btnText.textContent = 'Processing...';
        btnSpinner.style.display = 'block';
        sanitizeBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'flex';
    } else {
        btnText.textContent = 'Sanitize File';
        btnSpinner.style.display = 'none';
        sanitizeBtn.style.display = 'flex';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
}

function updateStatus(message, type = 'default') {
    statusText.textContent = message;
    statusBox.className = 'status-box'; // Reset classes
    statusBox.style.display = 'block';
    if (type === 'processing') statusBox.classList.add('processing');
    else if (type === 'success') statusBox.classList.add('success');
    else if (type === 'error') statusBox.classList.add('error');
}

function showError(message) {
    errorMessage.textContent = message;
    showModal(errorModal);
}

function showModal(modal) { if(modal) modal.style.display = 'flex'; }
function hideModal(modal) { if(modal) modal.style.display = 'none'; }

function resetForm() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    selectedFile = null;
    selectedFileType = null;
    selectedSanitizeMode = 'nlp'; // Reset to FAST mode
    fileInput.value = ''; // Clear the file input
    fileInfo.style.display = 'none';
    fileName.textContent = '';
    fileTypeSection.style.display = 'none';
    sanitizeModeSection.style.display = 'none';
    fileTypeSelect.value = '';
    sanitizeModeSelect.value = 'nlp'; // Reset dropdown to FAST
    fileTypeWarning.style.display = 'none';
    sanitizeBtn.disabled = true;
    statusBox.style.display = 'block';
    updateStatus('STATUS: Ready to sanitize files', 'default');
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }
    setProcessingState(false); // Ensure buttons are reset
}

// Run init function when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', init);

