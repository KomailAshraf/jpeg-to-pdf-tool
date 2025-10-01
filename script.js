// Initialize jsPDF safely
const jsPDF = window.jspdf?.jsPDF;
if (!jsPDF) {
    alert('jsPDF library not found. Please check your script includes.');
}

// Set up PDF.js worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
} else {
    alert('PDF.js library not found. Please check your script includes.');
}

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
const successMessage = document.getElementById('successMessage');

// Global variables
let uploadedImages = [];
let currentPDF = null;
let currentPDFBlob = null;
let currentPdfDoc = null;
let currentPageNum = 1;

// Event listeners
document.addEventListener('DOMContentLoaded', function () {
    browseBtn?.addEventListener('click', () => fileInput.click());
    fileInput?.addEventListener('change', handleFileSelect);
    uploadArea?.addEventListener('dragover', handleDragOver);
    uploadArea?.addEventListener('dragleave', handleDragLeave);
    uploadArea?.addEventListener('drop', handleDrop);
    convertBtn?.addEventListener('click', convertToPDF);
    downloadBtn?.addEventListener('click', downloadPDF);

    tabButtons?.forEach(button => {
        button.addEventListener('click', () => switchTab(button.getAttribute('data-tab')));
    });

    // Image actions using event delegation
    imageList?.addEventListener('click', function (e) {
        const imageItem = e.target.closest('.image-item');
        if (!imageItem) return;
        const idx = Number(imageItem.dataset.index);
        if (e.target.classList.contains('preview-btn')) previewImage(idx);
        if (e.target.classList.contains('remove-btn')) removeImage(idx);
    });

    // Accept all image types
    if (fileInput) fileInput.accept = 'image/*';
});

// Tab switching function
function switchTab(tabName) {
    tabButtons?.forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    document.querySelectorAll('.preview-container').forEach(container => {
        container.classList.toggle('active', container.id === tabName + 'Container');
        container.classList.toggle('hidden', container.id !== tabName + 'Container');
    });
    if (tabName === 'pdf-preview' && currentPDFBlob) renderPdfPreview(currentPDFBlob);
}

// File handling functions
function handleFileSelect(e) {
    processFiles(e.target.files);
}

function handleDragOver(e) {
    e.preventDefault();
    uploadArea?.classList.add('drag-over');
}

function handleDragLeave(e) {
    e.preventDefault();
    uploadArea?.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    uploadArea?.classList.remove('drag-over');
    processFiles(e.dataTransfer.files);
}

function processFiles(files) {
    Array.from(files).forEach(file => {
        if (!file.type.startsWith('image/')) {
            alert('Please upload only image files (JPG, PNG, GIF, BMP, WEBP, etc.)');
            return;
        }
        const reader = new FileReader();
        reader.onload = function (ev) {
            uploadedImages.push({
                name: file.name,
                size: formatFileSize(file.size),
                dataUrl: ev.target.result,
                file
            });
            updateImageList();
            updateConvertButton();
        };
        reader.readAsDataURL(file);
    });
}

function updateImageList() {
    if (!imageList) return;
    imageList.innerHTML = '';
    if (!uploadedImages.length) {
        imageList.innerHTML = '<div class="preview-placeholder">No images uploaded yet</div>';
        return;
    }
    uploadedImages.forEach((image, index) => {
        const imageItem = document.createElement('div');
        imageItem.className = 'image-item';
        imageItem.dataset.index = index;
        imageItem.innerHTML = `
            <img src="${image.dataUrl}" alt="${image.name}" class="image-thumb">
            <div class="image-info">
                <div class="image-name">${image.name}</div>
                <div class="image-size">${image.size}</div>
            </div>
            <div class="image-actions">
                <button class="btn btn-small preview-btn">Preview</button>
                <button class="btn btn-small btn-accent remove-btn">Remove</button>
            </div>
        `;
        imageList.appendChild(imageItem);
    });
}

function previewImage(index) {
    if (!imagePreviewContainer) return;
    const image = uploadedImages[index];
    imagePreviewContainer.innerHTML = `<img src="${image.dataUrl}" alt="${image.name}" class="preview-image">`;
    switchTab('image-preview');
}

function removeImage(index) {
    uploadedImages.splice(index, 1);
    updateImageList();
    updateConvertButton();
    if (!uploadedImages.length && imagePreviewContainer) {
        imagePreviewContainer.innerHTML = '<div class="preview-placeholder">Select an image to preview</div>';
    }
}

function updateConvertButton() {
    convertBtn && (convertBtn.disabled = !uploadedImages.length);
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Success message function
function showSuccessMessage(text) {
    if (successMessage) {
        successMessage.textContent = text;
        successMessage.style.display = 'block';
        successMessage.style.color = 'green';
        successMessage.style.fontWeight = 'bold';
        successMessage.style.marginTop = '10px';
    }
}

// Hide success message
function hideSuccessMessage() {
    if (successMessage) {
        successMessage.style.display = 'none';
        successMessage.textContent = '';
    }
}

// PDF conversion functions
function convertToPDF() {
    if (!uploadedImages.length) {
        alert('Please upload at least one image');
        return;
    }
    hideSuccessMessage();

    const originalText = convertBtn.innerHTML;
    convertBtn.innerHTML = '<span class="loading"></span>Converting...';
    convertBtn.disabled = true;

    setTimeout(() => {
        try {
            const pageSize = document.getElementById('pageSize')?.value || 'a4';
            const orientation = document.getElementById('pageOrientation')?.value || 'portrait';
            const imageQuality = document.getElementById('imageQuality')?.value || 'medium';
            const marginSize = parseInt(document.getElementById('marginSize')?.value || '10');
            const fitToPage = document.getElementById('fitToPage')?.checked ?? true;
            const addPageNumbers = document.getElementById('addPageNumbers')?.checked ?? false;
            const pdfTitle = document.getElementById('pdfTitle')?.value || 'Converted PDF';
            const pdfAuthor = document.getElementById('pdfAuthor')?.value || '';
            const pdfSubject = document.getElementById('pdfSubject')?.value || '';

            const pdf = new jsPDF({
                orientation,
                unit: 'mm',
                format: pageSize
            });
            pdf.setProperties({ title: pdfTitle, author: pdfAuthor, subject: pdfSubject });

            let quality = 1.0;
            if (imageQuality === 'medium') quality = 0.8;
            if (imageQuality === 'low') quality = 0.6;

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();

            const addImageToPDF = (image, index) => new Promise((resolve) => {
                const img = new window.Image();
                img.onload = function () {
                    let imgWidth = img.width;
                    let imgHeight = img.height;
                    const maxWidth = pageWidth - (marginSize * 2);
                    const maxHeight = pageHeight - (marginSize * 2);
                    if (fitToPage) {
                        const ratio = Math.min(maxWidth / imgWidth, maxHeight / imgHeight);
                        imgWidth *= ratio;
                        imgHeight *= ratio;
                    }
                    const x = (pageWidth - imgWidth) / 2;
                    const y = (pageHeight - imgHeight) / 2;
                    // Detect image format from dataUrl
                    const formatMatch = image.dataUrl.match(/^data:image\/(\w+);/i);
                    const imgFormat = formatMatch ? formatMatch[1].toUpperCase() : 'JPEG';

                    pdf.addImage(
                        image.dataUrl,
                        imgFormat, // 'JPEG', 'PNG', etc.
                        x,
                        y,
                        imgWidth,
                        imgHeight,
                        undefined,
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
                    resolve();
                };
                img.src = image.dataUrl;
            });

            // Sequentially add images to PDF for reliability
            const addImages = async () => {
                for (let i = 0; i < uploadedImages.length; i++) {
                    if (i) pdf.addPage();
                    await addImageToPDF(uploadedImages[i], i);
                }
                // Generate PDF blob for preview
                const pdfBlob = pdf.output('blob');
                currentPDFBlob = pdfBlob;
                currentPDF = pdf;
                downloadBtn && (downloadBtn.disabled = false);
                switchTab('pdf-preview');
                renderPdfPreview(pdfBlob);
                showSuccessMessage(`PDF created successfully with ${uploadedImages.length} pages!`);
            };
            addImages().finally(() => {
                convertBtn.innerHTML = originalText;
                convertBtn.disabled = false;
            });
        } catch (error) {
            console.error('PDF conversion error:', error);
            alert('Error creating PDF: ' + error.message);
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
        pdfPreviewContainer.innerHTML = '';
        const controls = document.createElement('div');
        controls.className = 'pdf-preview-controls';
        controls.innerHTML = `
            <button class="btn btn-small" id="prevPage" disabled>Previous</button>
            <span class="pdf-page-info">Page <span id="pageNum">1</span> of <span id="pageCount">${pdfDoc.numPages}</span></span>
            <button class="btn btn-small" id="nextPage">Next</button>
        `;
        const canvas = document.createElement('canvas');
        canvas.className = 'pdf-canvas';
        canvas.id = 'pdf-canvas';
        pdfPreviewContainer.appendChild(controls);
        pdfPreviewContainer.appendChild(canvas);
        renderPage(currentPageNum, canvas);

        controls.querySelector('#prevPage').onclick = () => {
            if (currentPageNum > 1) {
                currentPageNum--;
                renderPage(currentPageNum, canvas);
                updatePaginationControls();
            }
        };
        controls.querySelector('#nextPage').onclick = () => {
            if (currentPageNum < pdfDoc.numPages) {
                currentPageNum++;
                renderPage(currentPageNum, canvas);
                updatePaginationControls();
            }
        };

        function updatePaginationControls() {
            controls.querySelector('#pageNum').textContent = currentPageNum;
            controls.querySelector('#prevPage').disabled = currentPageNum <= 1;
            controls.querySelector('#nextPage').disabled = currentPageNum >= pdfDoc.numPages;
        }
    }).catch(error => {
        console.error('Error loading PDF for preview:', error);
        pdfPreviewContainer.innerHTML = '<div class="preview-placeholder">Error loading PDF preview</div>';
    });
}

function renderPage(pageNum, canvas) {
    if (!currentPdfDoc) return;
    currentPdfDoc.getPage(pageNum).then(page => {
        const viewport = page.getViewport({ scale: 1.5 });
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        page.render({ canvasContext: context, viewport });
    });
}

function downloadPDF() {
    if (currentPDF) {
        const pdfTitle = document.getElementById('pdfTitle')?.value || 'converted';
        currentPDF.save(`${pdfTitle}.pdf`);
    }
}