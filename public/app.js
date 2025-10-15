// --- MODIFIED: Configuration for Celery Backend ---
const API_BASE_URL = 'http://10.46.70.26:5001'; // Use a base URL now
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.txt']; // Added xls/xlsx
const FILE_TYPE_MAP = {
    '.csv': 'csv',
    '.xlsx': 'xlsx',
    '.xls': 'xls',
    '.txt': 'txt'
};

// --- MODIFIED: State Management ---
let selectedFile = null;
let selectedFileType = null;
let abortController = null;
let pollInterval = null; // To hold the setInterval ID

// --- UNCHANGED: DOM Elements ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileTypeSection = document.getElementById('fileTypeSection');
const fileTypeSelect = document.getElementById('fileTypeSelect');
const fileTypeWarning = document.getElementById('fileTypeWarning');
const sanitizeBtn = document.getElementById('sanitizeBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');
const statusBox = document.getElementById('statusBox');
const statusText = document.getElementById('statusText');
const successModal = document.getElementById('successModal');
const errorModal = document.getElementById('errorModal');
const errorMessage = document.getElementById('errorMessage');
const sanitizeAnother = document.getElementById('sanitizeAnother');
const closeError = document.getElementById('closeError');
const downloadSection = document.getElementById('downloadSection');
const downloadBtn = document.getElementById('downloadBtn');
const sanitizeAnotherBtn = document.getElementById('sanitizeAnotherBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Initialize
function init() {
    setupEventListeners();
}

function setupEventListeners() {
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    fileTypeSelect.addEventListener('change', handleFileTypeChange);
    sanitizeBtn.addEventListener('click', handleSanitize);
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }
    sanitizeAnother.addEventListener('click', resetForm);
    closeError.addEventListener('click', () => hideModal(errorModal));
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            // The download button is now a link, but we can still trigger it
            // This is handled when the link is created in showDownloadLink
        });
    }
    if (sanitizeAnotherBtn) {
        sanitizeAnotherBtn.addEventListener('click', resetForm);
    }
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
    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/1LqvkXzuh5EVk-IQGraHmV2qX5orvB47mjYMTHbn5zOU/preview', '_blank');
        });
    }
}

// --- UNCHANGED: Drag/Drop and File Handling ---
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

// --- UNCHANGED: File Validation and UI Updates ---
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

function validateFile(file) {
    if (file.size > MAX_FILE_SIZE) return { valid: false, message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) return { valid: false, message: `Unsupported file type. Please upload CSV, XLSX, XLS, or TXT files` };
    return { valid: true };
}

// --- REWRITTEN: handleSanitize to start the job ---
async function handleSanitize() {
    if (!selectedFile || !selectedFileType) {
        showError('Please select a file type before sanitizing');
        return;
    }
    if (downloadSection) downloadSection.style.display = 'none';
    
    setProcessingState(true);
    updateStatus('STATUS: Submitting job...', 'processing');
    
    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('file_type', selectedFileType);
        formData.append('use_llm', 'true');
        
        // 1. Submit the file to get a job_id
        const response = await fetch(`${API_BASE_URL}/sanitize_csv`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }

        const data = await response.json();
        const jobId = data.job_id;

        // 2. Start polling for the status of the job
        if (jobId) {
            pollStatus(jobId);
        } else {
            throw new Error('Failed to get a valid job ID from the server.');
        }

    } catch (error) {
        console.error('Sanitization submission error:', error);
        updateStatus('STATUS: Job submission failed', 'error');
        showError(error.message || 'An error occurred during job submission.');
        setProcessingState(false);
    }
}

// --- NEW: pollStatus function ---
function pollStatus(jobId) {
    updateStatus('STATUS: Job queued. Waiting for worker...', 'processing');
    
    pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/status/${jobId}`);
            if (!response.ok) {
                // If status check fails, stop polling and show error
                throw new Error('Server returned an error while checking status.');
            }

            const data = await response.json();

            // Update UI based on the state from the server
            if (data.state === 'PROGRESS') {
                updateStatus(`STATUS: ${data.status || 'Processing...'}`, 'processing');
            } else if (data.state === 'PENDING') {
                updateStatus('STATUS: Job is pending...', 'processing');
            }

            // If the job is finished (SUCCESS or FAILURE)
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
            console.error('Polling Error:', error);
            clearInterval(pollInterval); // Stop polling on network or server error
            pollInterval = null;
            updateStatus('STATUS: Connection lost', 'error');
            showError('Failed to get job status. Please check the network and try again.');
            setProcessingState(false);
        }
    }, 3000); // Poll every 3 seconds
}

// --- NEW: showDownloadLink function ---
function showDownloadLink(jobId) {
    if (downloadSection) {
        const resultUrl = `${API_BASE_URL}/result/${jobId}`;
        // Set the href for the download button which is now an anchor tag in spirit
        downloadBtn.onclick = () => {
            window.location.href = resultUrl;
        };
        downloadSection.style.display = 'block';
        downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}


function handleCancel() {
    // Note: This only cancels the polling from the client-side.
    // The server-side task will continue to run.
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        updateStatus('STATUS: Aborted by user', 'default');
        setProcessingState(false);
    }
}

// --- UNCHANGED: UI Helper Functions ---
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
    statusBox.className = 'status-box';
    statusBox.style.display = 'block';
    if (type === 'processing') statusBox.classList.add('processing');
    else if (type === 'success') statusBox.classList.add('success');
    else if (type === 'error') statusBox.classList.add('error');
}

function showError(message) {
    errorMessage.textContent = message;
    showModal(errorModal);
}

function showModal(modal) { modal.style.display = 'flex'; }
function hideModal(modal) { modal.style.display = 'none'; }

// --- MODIFIED: resetForm to clear polling ---
function resetForm() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    selectedFile = null;
    selectedFileType = null;
    fileInput.value = '';
    fileInfo.style.display = 'none';
    fileTypeSection.style.display = 'none';
    fileTypeSelect.value = '';
    fileTypeWarning.style.display = 'none';
    sanitizeBtn.disabled = true;
    statusBox.style.display = 'block';
    updateStatus('STATUS: Ready to sanitize files', 'default');
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }
    hideModal(successModal);
}

document.addEventListener('DOMContentLoaded', init);

