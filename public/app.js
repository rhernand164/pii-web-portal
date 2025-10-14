// Configuration
const API_ENDPOINT = 'http://10.46.70.26:5001/sanitize_csv';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_EXTENSIONS = ['.csv','.txt'];
const FILE_TYPE_MAP = {
    '.csv': 'csv',
    '.txt': 'txt'
};

// State
let selectedFile = null;
let selectedFileType = null;
let sanitizedBlob = null;  
let sanitizedFileName = null; 
let abortController = null;

// DOM Elements
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

// Initialize
function init() {
    setupEventListeners();
}

function setupEventListeners() {
    // Drop zone click
    dropZone.addEventListener('click', () => fileInput.click());
    
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Drag and drop
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
    
    // File type selection
    fileTypeSelect.addEventListener('change', handleFileTypeChange);
    
    // Sanitize button
    sanitizeBtn.addEventListener('click', handleSanitize);
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleCancel);
    }
    // Modal buttons
    sanitizeAnother.addEventListener('click', resetForm);
    closeError.addEventListener('click', () => hideModal(errorModal));

    const downloadBtn = document.getElementById('downloadBtn');
    const sanitizeAnotherBtn = document.getElementById('sanitizeAnotherBtn');

    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
    }
    if (sanitizeAnotherBtn) {
        sanitizeAnotherBtn.addEventListener('click', resetForm);
    }

    closeError.addEventListener('click', () => hideModal(errorModal));
    
    // About PII button and modal
    const aboutBtn = document.getElementById('aboutBtn');
    const aboutModal = document.getElementById('aboutModal');
    const closeAbout = document.getElementById('closeAbout');
    
    if (aboutBtn && aboutModal && closeAbout) {
        aboutBtn.addEventListener('click', () => showModal(aboutModal));
        closeAbout.addEventListener('click', () => hideModal(aboutModal));
        
        // Close modal when clicking outside
        aboutModal.addEventListener('click', (e) => {
            if (e.target === aboutModal) {
                hideModal(aboutModal);
            }
        });
    }

    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => {
            window.open('https://docs.google.com/forms/d/1LqvkXzuh5EVk-IQGraHmV2qX5orvB47mjYMTHbn5zOU/preview', '_blank');
        });
    }
}

function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
}

function handleFile(file) {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
        showError(validation.message);
        return;
    }
    
    // Hide download section when new file is selected
    const downloadSection = document.getElementById('downloadSection');
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }
    
    // Store file and update UI
    selectedFile = file;
    fileName.textContent = file.name;
    fileInfo.style.display = 'block';
    
    // Auto-detect file type
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const detectedType = FILE_TYPE_MAP[fileExt] || '';
    
    // Show file type selector and pre-select detected type
    fileTypeSection.style.display = 'block';
    fileTypeSelect.value = detectedType;
    selectedFileType = detectedType;
    
    // Hide warning initially
    fileTypeWarning.style.display = 'none';
    
    // Enable sanitize button only if file type is selected
    sanitizeBtn.disabled = !selectedFileType;
    
    // Show status box
    statusBox.style.display = 'block';
    updateStatus('STATUS: Select file type to continue', 'default');
}

function handleFileTypeChange(e) {
    selectedFileType = e.target.value;
    
    if (!selectedFileType) {
        sanitizeBtn.disabled = true;
        fileTypeWarning.style.display = 'none';
        updateStatus('STATUS: Please select a file type', 'default');
        return;
    }
    
    // Check if selected type matches file extension
    const fileExt = selectedFile.name.substring(selectedFile.name.lastIndexOf('.')).toLowerCase();
    const detectedType = FILE_TYPE_MAP[fileExt];
    
    if (selectedFileType !== detectedType) {
        fileTypeWarning.style.display = 'block';
        fileTypeWarning.textContent = `⚠️ Warning: Selected type "${selectedFileType.toUpperCase()}" doesn't match file extension "${fileExt}"`;
    } else {
        fileTypeWarning.style.display = 'none';
    }
    
    sanitizeBtn.disabled = false;
    updateStatus('STATUS: File ready to sanitize', 'default');
}

function validateFile(file) {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
        return {
            valid: false,
            message: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
        };
    }
    
    // Check file extension
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
        return {
            valid: false,
            message: `Unsupported file type. Please upload CSV, or TXT files`
        };
    }
    
    return { valid: true };
}

function handleDownload() {
    if (sanitizedBlob && sanitizedFileName) {
        downloadFile(sanitizedBlob, sanitizedFileName);
    }
}

async function handleSanitize() {
    if (!selectedFile || !selectedFileType) {
        showError('Please select a file type before sanitizing');
        return;
    }
    
    // Hide download section if visible
    const downloadSection = document.getElementById('downloadSection');
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }
    
    // Create abort controller for this request
    abortController = new AbortController();
    
    // Update UI to processing state
    setProcessingState(true);
    updateStatus('STATUS: Sanitizing file... This may take a moment', 'processing');
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('file_type', selectedFileType);
        formData.append('use_llm', 'true');
        
        // Make API request with abort signal
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            body: formData,
            signal: abortController.signal  // Add abort signal
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        // Get the sanitized file
        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let downloadFileName = 'sanitized_file';
        
        // Set proper extension based on file type
        const extension = selectedFileType === 'txt' ? '.txt' : '.csv';
        downloadFileName = `sanitized_${selectedFile.name.replace(/\.[^/.]+$/, '')}${extension}`;
        
        if (contentDisposition) {
            const fileNameMatch = contentDisposition.match(/filename="?(.+)"?/i);
            if (fileNameMatch) {
                downloadFileName = fileNameMatch[1];
            }
        }
        
        // Store the blob and filename for later download
        sanitizedBlob = blob;
        sanitizedFileName = downloadFileName;
        
        // Show download section
        updateStatus('STATUS: Sanitization complete!', 'success');
        if (downloadSection) {
            downloadSection.style.display = 'block';
            downloadSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
    } catch (error) {
        // Check if error was due to abort
        if (error.name === 'AbortError') {
            console.log('Sanitization cancelled by user');
            updateStatus('STATUS: Sanitization cancelled', 'default');
        } else {
            console.error('Sanitization error:', error);
            updateStatus('STATUS: Sanitization failed', 'error');
            showError(error.message || 'An error occurred during sanitization. Please try again.');
        }
    } finally {
        setProcessingState(false);
        abortController = null;  // Clear abort controller
    }
}

function handleCancel() {
    if (abortController) {
        abortController.abort();
        updateStatus('STATUS: Cancelling...', 'default');
    }
}

function downloadFile(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

function setProcessingState(isProcessing) {
    const cancelBtn = document.getElementById('cancelBtn');
    
    sanitizeBtn.disabled = isProcessing;
    
    if (isProcessing) {
        btnText.textContent = 'Processing...';
        btnSpinner.style.display = 'block';
        sanitizeBtn.style.display = 'none';  // Hide sanitize button
        if (cancelBtn) {
            cancelBtn.style.display = 'flex';  // Show cancel button
        }
    } else {
        btnText.textContent = 'Sanitize File';
        btnSpinner.style.display = 'none';
        sanitizeBtn.style.display = 'flex';  // Show sanitize button
        if (cancelBtn) {
            cancelBtn.style.display = 'none';  // Hide cancel button
        }
    }
}

function updateStatus(message, type = 'default') {
    statusText.textContent = message;
    statusBox.className = 'status-box';
    statusBox.style.display = 'block';  // Ensure it's visible
    
    if (type === 'processing') {
        statusBox.classList.add('processing');
    } else if (type === 'success') {
        statusBox.classList.add('success');
    } else if (type === 'error') {
        statusBox.classList.add('error');
    }
}

function showError(message) {
    errorMessage.textContent = message;
    showModal(errorModal);
}

function showModal(modal) {
    modal.style.display = 'flex';
}

function hideModal(modal) {
    modal.style.display = 'none';
}

function resetForm() {
    // Reset state
    selectedFile = null;
    selectedFileType = null;
    sanitizedBlob = null;
    sanitizedFileName = null;
    fileInput.value = '';
    
    // Reset UI
    fileInfo.style.display = 'none';
    fileTypeSection.style.display = 'none';
    fileTypeSelect.value = '';
    fileTypeWarning.style.display = 'none';
    sanitizeBtn.disabled = true;
    
    // Show status box with default message
    statusBox.style.display = 'block';
    updateStatus('STATUS: Ready to sanitize files', 'default');
    
    // Hide download section
    const downloadSection = document.getElementById('downloadSection');
    if (downloadSection) {
        downloadSection.style.display = 'none';
    }
    
    // Hide modal
    hideModal(successModal);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
