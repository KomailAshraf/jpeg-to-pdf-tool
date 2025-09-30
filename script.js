// Initialize jsPDF
const { jsPDF } = window.jspdf;

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// DOM elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const browseBtn = document.getElementById('browseBtn');
const imageList = document.getElementById('imageList');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const pdfPreviewContainer = document.getElementById('pdfPreviewContainer');
const convertBtn = document.getElementById('convertBtn');
const downloadBtn = document.getElementById('downloadBtn');
const tabButtons = document.querySelectorAll('.tab-btn');

// Global variables
let uploadedImages = [];
let currentPDF = null;
let currentPDFBlob = null;
let currentPdfDoc = null;
let currentPageNum = 1;

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    convertBtn.addEventListener('click', convertToPDF);
    downloadBtn.addEventListener('click', downloadPDF);
    
    // Tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
});

// Tab switching function
function switchTab(tabName) {
    // Update active tab button
    tabButtons.forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabName) {
            btn.classList.add('active');
        }
    });
    
    // Show corresponding preview container
    document.querySelectorAll('.preview-container').forEach(container => {
        container.classList.add('hidden');
        container.classList.remove('active');
    });
    
    const activeContainer = document.getElementById(tabName + 'Container');
    activeContainer.classList.remove('hidden');
    activeContainer.classList.add('active');
    
    // If switching to PDF preview and PDF exists, render it
    if (tabName === 'pdf-preview' && currentPDFBlob) {
        renderPdfPreview(currentPDFBlob);
    }
}

// File handling functions
function handleFileSelect(e) {
    const files = e.target.files;
    processFiles(files);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    processFiles(files);
}

function processFiles(files) {
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check if file is JPEG
        if (!file.type.match('image/jpeg') && !file.name.toLowerCase().endsWith('.jpg') && !file.name.toLowerCase().endsWith('.jpeg')) {
            alert('Please upload only JPEG images');
            continue;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const imageData = {
                name: file.name,
                size: formatFileSize(file.size),
                dataUrl: e.target.result,
                file: file
            };
            
            uploadedImages.push(imageData);
            updateImageList();
            updateConvertButton();
        };
        
        reader.readAsDataURL(file);
    }
}

function updateImageList() {
    imageList.innerHTML = '';
    
    if (uploadedImages.length === 0) {
        imageList.innerHTML = '<div class="preview-placeholder">No images uploaded yet</div>';
        return;
    }
    
    uploadedImages.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        
        imageItem.innerHTML = `
            <img src="${image.dataUrl}" alt="${image.name}" class="image-thumb">
            <div class="image-info">
                <div class="image-name">${image.name}</div>
                <div class="image-size">${image.size}</div>
            </div>
            <div class="image-actions">
                <button class="btn btn-small" onclick="previewImage(${index})">Preview</button>
                <button class="btn btn-small btn-accent" onclick="removeImage(${index})">Remove</button>
            </div>
        `;
        
        imageList.appendChild(imageItem);
    });
}

function previewImage(index) {
    const image = uploadedImages[index];
    imagePreviewContainer.innerHTML = `<img src="${image.dataUrl}" alt="${image.name}" class="preview-image">`;
    
    // Switch to image preview tab
    switchTab('image-preview');
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    updateImageList();
    updateConvertButton();
    
    // Clear preview if no images left
    if (uploadedImages.length === 0) {
        imagePreviewContainer.innerHTML = '<div class="preview-placeholder">Select an image to preview</div>';
    }
}

function updateConvertButton() {
    convertBtn.disabled = uploadedImages.length === 0;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// PDF conversion functions
function convertToPDF() {
    if (uploadedImages.length === 0) {
        alert('Please upload at least one image');
        return;
    }
    
    // Show loading state
    const originalText = convertBtn.innerHTML;
    convertBtn.innerHTML = '<span class="loading"></span>Converting...';
    convertBtn.disabled = true;
    
    setTimeout(() => {
        try {
            // Get conversion options
            const pageSize = document.getElementById('pageSize').value;
            const orientation = document.getElementById('pageOrientation').value;
            const imageQuality = document.getElementById('imageQuality').value;
            const marginSize = parseInt(document.getElementById('marginSize').value);
            const fitToPage = document.getElementById('fitToPage').checked;
            const addPageNumbers = document.getElementById('addPageNumbers').checked;
            
            // Get PDF metadata
            const pdfTitle = document.getElementById('pdfTitle').value || 'Converted PDF';
            const pdfAuthor = document.getElementById('pdfAuthor').value || '';
            const pdfSubject = document.getElementById('pdfSubject').value || '';
            
            // Create PDF document
            const pdf = new jsPDF({
                orientation: orientation,
                unit: 'mm',
                format: pageSize
            });
            
            // Set PDF properties
            pdf.setProperties({
                title: pdfTitle,
                author: pdfAuthor,
                subject: pdfSubject
            });
            
            // Set quality factor based on selection
            let quality = 1.0;
            if (imageQuality === 'medium') quality = 0.8;
            if (imageQuality === 'low') quality = 0.6;
            
            // Add images to PDF
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            
            uploadedImages.forEach((image, index) => {
                if (index > 0) {
                    pdf.addPage();
                }
                
                const img = new Image();
                img.src = image.dataUrl;
                
                let imgWidth = img.width;
                let imgHeight = img.height;
                
                // Calculate dimensions to fit page with margins
                const maxWidth = pageWidth - (marginSize * 2);
                const maxHeight = pageHeight - (marginSize * 2);
                
                if (fitToPage) {
                    const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                    imgWidth *= ratio;
                    imgHeight *= ratio;
                }
                
                // Center image on page
                const x = (pageWidth - imgWidth) / 2;
                const y = (pageHeight - imgHeight) / 2;
                
                pdf.addImage(
                    image.dataUrl, 
                    'JPEG', 
                    x, 
                    y, 
                    imgWidth, 
                    imgHeight, 
                    null, 
                    'FAST', 
                    0, 
                    quality
                );
                
                // Add page numbers if enabled
                if (addPageNumbers) {
                    pdf.setFontSize(10);
                    pdf.setTextColor(128);
                    pdf.text(
                        `Page ${index + 1} of ${uploadedImages.length}`,
                        pageWidth / 2,
                        pageHeight - 10,
                        { align: 'center' }
                    );
                }
            });
            
            // Generate PDF blob for preview
            const pdfBlob = pdf.output('blob');
            currentPDFBlob = pdfBlob;
            currentPDF = pdf;
            
            // Enable download button
            downloadBtn.disabled = false;
            
            // Switch to PDF preview and render
            switchTab('pdf-preview');
            renderPdfPreview(pdfBlob);
            
            // Show success message
            alert(`PDF created successfully with ${uploadedImages.length} pages!`);
            
        } catch (error) {
            console.error('PDF conversion error:', error);
            alert('Error creating PDF: ' + error.message);
        } finally {
            // Restore button state
            convertBtn.innerHTML = originalText;
            convertBtn.disabled = false;
        }
    }, 100);
}

// PDF preview functions
function renderPdfPreview(pdfBlob) {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    pdfjsLib.getDocument(pdfUrl).promise.then(pdfDoc => {
        currentPdfDoc = pdfDoc;
        currentPageNum = 1;
        
        // Clear previous preview
        pdfPreviewContainer.innerHTML = '';
        
        // Create preview controls
        const controls = document.createElement('div');
        controls.className = 'pdf-preview-controls';
        controls.innerHTML = `
            <button class="btn btn-small" id="prevPage" disabled>Previous</button>
            <span class="pdf-page-info">Page <span id="pageNum">1</span> of <span id="pageCount">${pdfDoc.numPages}</span></span>
            <button class="btn btn-small" id="nextPage">Next</button>
        `;
        
        // Create canvas for rendering
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.id = 'pdf-canvas';
        
        pdfPreviewContainer.appendChild(controls);
        pdfPreviewContainer.appendChild(canvas);
        
        // Render first page
        renderPage(currentPageNum, canvas);
        
        // Add event listeners for page navigation
        document.getElementById('prevPage').addEventListener('click', () => {
            if (currentPageNum > 1) {
                currentPageNum--;
                renderPage(currentPageNum, canvas);
                updatePaginationControls();
            }
        });
        
        document.getElementById('nextPage').addEventListener('click', () => {
            if (currentPageNum < pdfDoc.numPages) {
                currentPageNum++;
                renderPage(currentPageNum, canvas);
                updatePaginationControls();
            }
        });
        
        function updatePaginationControls() {
            document.getElementById('pageNum').textContent = currentPageNum;
            document.getElementById('prevPage').disabled = currentPageNum <= 1;
            document.getElementById('nextPage').disabled = currentPageNum >= pdfDoc.numPages;
        }
        
    }).catch(error => {
        console.error('Error loading PDF for preview:', error);
        pdfPreviewContainer.innerHTML = '<div class="preview-placeholder">Error loading PDF preview</div>';
    });
}

function renderPage(pageNum, canvas) {
    currentPdfDoc.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale: 1.5 });
        const context = canvas.getContext('2d');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        page.render(renderContext);
    });
}

function downloadPDF() {
    if (currentPDF) {
        const pdfTitle = document.getElementById('pdfTitle').value || 'converted';
        currentPDF.save(`${pdfTitle}.pdf`);
    }
}

// Make functions available globally for onclick handlers
window.previewImage = previewImage;
window.removeImage = removeImage;