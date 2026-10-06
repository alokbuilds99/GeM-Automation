class GeMBiddingDataExtractor {
    constructor() {
        this.uploadedFiles = [];
        this.extractedData = [];
        this.isProcessingFiles = false;
        this.isGeneratingExcel = false;
        this.initializeEventListeners();
        this.loadPDFJS();
    }

    async loadPDFJS() {
        // Load pdf.js dynamically for PDF text extraction
        if (typeof pdfjsLib === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                console.log('PDF.js loaded successfully');
            };
            document.head.appendChild(script);
        }
    }

    initializeEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const generateBtn = document.getElementById('generateBtn');

        // Prevent multiple event listeners by checking if already initialized
        if (uploadArea.dataset.initialized === 'true') {
            console.log('Event listeners already initialized, skipping...');
            return;
        }

        console.log('Initializing event listeners...');

        // Click to upload - simplified and direct
        uploadArea.addEventListener('click', (e) => {
            // Only handle clicks on the upload area itself, not its children
            if (e.target === uploadArea || e.target.closest('.upload-icon') || e.target.closest('.upload-text') || e.target.closest('.upload-subtext')) {
                console.log('Upload area clicked, opening file selector...');
                fileInput.click();
            }
        });

        // File input change - with validation
        fileInput.addEventListener('change', (e) => {
            console.log('File input change event triggered');
            if (e.target.files && e.target.files.length > 0) {
                this.handleFileSelect(e.target.files);
            }
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                this.handleFileSelect(e.dataTransfer.files);
            }
        });

        // Generate Excel button - with validation
        generateBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Generate button clicked');
            if (!generateBtn.disabled) {
                this.generateExcel();
            }
        });

        // Mark as initialized to prevent duplicate listeners
        uploadArea.dataset.initialized = 'true';
        console.log('Event listeners initialized successfully');
        
        // Add some debugging info
        console.log('Upload area element:', uploadArea);
        console.log('File input element:', fileInput);
        console.log('Generate button element:', generateBtn);
    }

    handleFileSelect(files) {
        // Prevent multiple simultaneous calls
        if (this.isProcessingFiles) {
            console.log('File processing already in progress, ignoring new selection');
            return;
        }
        
        console.log('handleFileSelect called with', files.length, 'files');
        
        this.isProcessingFiles = true;
        
        try {
            const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');
            
            if (pdfFiles.length === 0) {
                this.showStatus('Please select PDF files only.', 'error');
                return;
            }

            this.uploadedFiles = pdfFiles;
            this.updateFileList();
            this.updateGenerateButton();
            this.showStatus(`Uploaded ${pdfFiles.length} PDF file(s) successfully!`, 'success');
            
            console.log('Files processed successfully:', pdfFiles.length);
        } catch (error) {
            console.error('Error in handleFileSelect:', error);
            this.showStatus('Error processing files. Please try again.', 'error');
        } finally {
            this.isProcessingFiles = false;
        }
    }

    updateFileList() {
        const fileList = document.getElementById('uploadedFiles');
        fileList.innerHTML = '';

        this.uploadedFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            
            const fileSize = this.formatFileSize(file.size);
            
            fileItem.innerHTML = `
                <div class="file-info">
                    <div class="file-icon">
                        <i class="fas fa-file-pdf"></i>
                    </div>
                    <div class="file-details">
                        <h4>${file.name}</h4>
                        <p>${fileSize}</p>
                    </div>
                </div>
                <button class="remove-file" onclick="app.removeFile(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            `;
            
            fileList.appendChild(fileItem);
        });
    }

    removeFile(index) {
        this.uploadedFiles.splice(index, 1);
        this.updateFileList();
        this.updateGenerateButton();
    }

    updateGenerateButton() {
        const generateBtn = document.getElementById('generateBtn');
        generateBtn.disabled = this.uploadedFiles.length === 0;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async generateExcel() {
        // Prevent multiple simultaneous executions
        if (this.isGeneratingExcel) {
            console.log('Excel generation already in progress, ignoring request');
            return;
        }
        
        if (this.uploadedFiles.length === 0) {
            this.showStatus('No files to process.', 'error');
            return;
        }

        this.isGeneratingExcel = true;
        this.showProgress();
        this.extractedData = [];

        try {
            for (let i = 0; i < this.uploadedFiles.length; i++) {
                const file = this.uploadedFiles[i];
                this.updateProgress((i / this.uploadedFiles.length) * 30, `Processing ${file.name}...`);
                
                const data = await this.extractDataFromPDF(file);
                if (data) {
                    this.extractedData.push(data);
                    this.updateProgress(((i + 1) / this.uploadedFiles.length) * 30, `Extracted data from ${file.name}`);
                }
                
                // Small delay to show progress
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            this.updateProgress(60, 'Validating extracted data...');
            await new Promise(resolve => setTimeout(resolve, 200));

            this.updateProgress(80, 'Generating Excel file...');
            await this.createExcelFile();
            
            this.updateProgress(100, 'Excel file ready for download!');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            this.hideProgress();
            this.showDownloadSection();
            this.showStatus('Excel file generated successfully!', 'success');
            
        } catch (error) {
            console.error('Error generating Excel:', error);
            this.hideProgress();
            this.showStatus('Error generating Excel file. Please try again.', 'error');
        } finally {
            this.isGeneratingExcel = false;
        }
    }

    // NEW FUNCTION: Debug extraction process
    debugExtraction(text, filename) {
        console.log('=== EXTRACTION DEBUG ===');
        console.log('Filename:', filename);
        console.log('Text length:', text.length);
        
        // Find key sections
        const lines = text.split('\n');
        let itemSectionStart = -1;
        let itemSectionEnd = -1;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('VARIOUS TYPES OF ELECTRICAL SPARES') || 
                line.includes('Item Category/') || 
                line.includes('मद केटेगरी') ||
                (line.includes('Bid Details') && line.includes('बिड विवरण'))) {
                itemSectionStart = i;
                console.log('Item section starts at line:', i, 'Content:', line);
            }
            
            if (itemSectionStart > -1 && ['Experience Criteria', 'Preference to Make In India', 
                'Purchase preference for MSEs', 'Estimated Bid Value', 'Past Performance'].some(stop => 
                line.includes(stop))) {
                itemSectionEnd = i;
                console.log('Item section ends at line:', i, 'Content:', line);
                break;
            }
        }
        
        if (itemSectionStart > -1) {
            console.log('Item section lines:');
            for (let i = itemSectionStart; i < Math.min(itemSectionStart + 20, lines.length); i++) {
                if (i === itemSectionEnd) break;
                console.log(`Line ${i}:`, lines[i].trim());
            }
        }
        
        // Show what patterns are found
        const electricalPatterns = [
            'Switch Socket', 'Plug Top', 'Holder BC', 'Insulation Tape', 'Capacitor',
            'Tube Light', 'Lamp', 'Cable', 'Contactor', 'Relay', 'Timer', 'Diode'
        ];
        
        console.log('Electrical component patterns found:');
        electricalPatterns.forEach(pattern => {
            if (text.includes(pattern)) {
                console.log('✓', pattern);
            } else {
                console.log('✗', pattern);
            }
        });
        
        console.log('=== END DEBUG ===');
    }

    async extractDataFromPDF(file) {
        try {
            if (typeof pdfjsLib === 'undefined') {
                // Wait for PDF.js to load
                await new Promise(resolve => setTimeout(resolve, 1000));
                if (typeof pdfjsLib === 'undefined') {
                    throw new Error('PDF.js library not loaded');
                }
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            let links = [];
            let positionedPages = [];
            
            // Extract both text and annotations from all pages
            for (let i = 1; i <= pdf.numPages; i++) {
                try {
                const page = await pdf.getPage(i);
                    
                    // Get text content
                    const pageTextContent = await page.getTextContent();
                    const pageTextStr = pageTextContent.items.map(item => item.str).join(' ');
                    fullText += pageTextStr + '\n';

                    // Keep where each piece of text sits on the page. The bid-details table is
                    // read by position (see buildBidDetailRows), not from the flat text above.
                    positionedPages.push({
                        pageNum: i,
                        items: pageTextContent.items
                            .filter(item => item.str && item.str.trim() !== '' && item.transform)
                            .map(item => ({
                                str: item.str,
                                x: item.transform[4],
                                y: item.transform[5],
                                width: item.width || 0,
                                height: item.height || 9
                            }))
                    });
                    
                    // Helper function to get text context around a position
                    const getContextText = async (rect) => {
                        const linkTextContent = await page.getTextContent();
                        const items = linkTextContent.items;
                        const contextChars = 200; // Increased context range to better catch specification text
                        let context = '';
                        
                        // Find items near the link vertically
                        const nearbyItems = items.filter(item => {
                            const itemY = item.transform[5];
                            return Math.abs(itemY - rect[1]) < 100; // Increased vertical range to catch more context
                        });
                        
                        // Sort by X position and join
                        context = nearbyItems
                            .sort((a, b) => a.transform[4] - b.transform[4])
                            .map(item => item.str)
                            .join(' ')
                            .trim();
                            
                        // Limit context length
                        if (context.length > contextChars) {
                            const startIdx = Math.max(0, Math.floor(context.length / 2) - contextChars / 2);
                            context = context.substr(startIdx, contextChars);
                        }
                        
                        return context;
                    };

                    // Helper function to categorize links
                    const categorizeLink = (url, contextText, pageText) => {
                        console.log('\n=== Technical Specification Link Analysis ===');
                        console.log('URL:', url);
                        console.log('Context:', contextText);
                        
                        const lowerContext = contextText.toLowerCase();
                        const lowerUrl = url.toLowerCase();
                        const lowerPageText = pageText?.toLowerCase() || '';
                        
                        // BOQ Detail Document (KEEP UNCHANGED)
                        if (lowerContext.includes('boq detail document') || 
                            lowerContext.includes('boq document') ||
                            (lowerContext.includes('boq') && lowerContext.includes('view file')) ||
                            lowerUrl.includes('boqdocument') ||
                            lowerUrl.includes('boq_detail_document')) {
                            console.log('✅ Categorized as: BOQ Detail Document');
                            return 'BOQ Detail Document';
                        }
                        
                        // Buyer Specification Document (KEEP UNCHANGED)
                        if (lowerContext.includes('buyer specification document') || 
                            lowerContext.includes('buyer spec') ||
                            (lowerContext.includes('specification') && lowerContext.includes('download')) ||
                            lowerUrl.includes('buyer_specification') ||
                            lowerUrl.includes('buyerspecification') ||
                            lowerUrl.includes('spec_document')) {
                            console.log('✅ Categorized as: Buyer Specification Document');
                            return 'Buyer Specification Document';
                        }
                        
                        // DEBUG: Check if URL is being incorrectly categorized
                        if (lowerUrl.includes('gem.gov.in') && 
                            (lowerUrl.includes('spec') || lowerUrl.includes('document') || lowerUrl.includes('pdf'))) {
                            console.log('🔍 DEBUG: Found gem.gov.in URL - checking for misclassification');
                            console.log('   URL:', url);
                            console.log('   Context:', contextText);
                        }
                        
                        // GeM Category Specification - IMPROVED DETECTION
                        console.log('\n=== Analyzing PDF Content ===');
                        console.log('Page Text Sample:', pageText?.substring(0, 200) + '...');
                        
                        // FIRST: Check if the context text itself contains GeM Category Specification patterns
                        // This handles the 3rd format where the link is embedded in the GeM Category text
                        
                        const gemSpecContextPatterns = [
                            'as per gem category specification',
                            'जेम केटेगरी विशिष्टि के अनुसार',
                            '*as per gem category specification',
                            '* जेम केटेगरी विशिष्टि के अनुसार',
                            'gem category specification',
                            'जेम केटेगरी विशिष्टि'
                        ];
                        
                        for (const pattern of gemSpecContextPatterns) {
                            if (lowerContext.includes(pattern)) {
                                console.log(`✅ Found GeM pattern in context: "${pattern}"`);
                                
                                // If this URL isn't already categorized as BOQ or Buyer Spec
                                if (!lowerUrl.includes('boq') && 
                                    !lowerUrl.includes('buyer') && 
                                    !lowerUrl.includes('specification_document')) {
                                    return 'GeM Category Specification';
                                }
                            }
                        }
                        
                        // SECOND: Check for Technical Specifications section in page text
                        const headerPatterns = [
                            'Technical Specifications',
                            'Technical Specifications/तकनीकी विशिष्टियाँ',
                            'तकनीकी विशिष्टियाँ'
                        ];
                        
                        let headerFound = false;
                        let headerIndex = -1;
                        
                        for (const pattern of headerPatterns) {
                            headerIndex = pageText?.indexOf(pattern) ?? -1;
                            if (headerIndex !== -1) {
                                headerFound = true;
                                console.log('Found header pattern:', pattern);
                                break;
                            }
                        }
                        
                        if (headerFound) {
                            console.log('✅ Found Technical Specifications section');
                            
                            // Get text after header (up to 1000 chars for better coverage)
                            const afterHeader = pageText.substring(headerIndex, headerIndex + 1000);
                            
                            // Look for GeM Category text in the section after header
                            const gemSpecPatterns = [
                                'As per GeM Category Specification',
                                'जेम केटेगरी विशिष्टि के अनुसार',
                                '*As per GeM Category Specification',
                                '* जेम केटेगरी विशिष्टि के अनुसार',
                                'GeM Category Specification',
                                'जेम केटेगरी विशिष्टि'
                            ];
                            
                            for (const pattern of gemSpecPatterns) {
                                if (afterHeader.includes(pattern)) {
                                    console.log(`✅ Found GeM pattern in section: "${pattern}"`);
                                    
                                    // If this URL isn't already categorized as BOQ or Buyer Spec
                                    if (!lowerUrl.includes('boq') && 
                                        !lowerUrl.includes('buyer') && 
                                        !lowerUrl.includes('specification_document')) {
                                        return 'GeM Category Specification';
                                    }
                                }
                            }
                            
                            // SPECIAL CASE: If we're in Technical Specifications section and no other patterns match,
                            // and the URL looks like a specification document, categorize as GeM Category
                            if (lowerUrl.includes('gem.gov.in') && 
                                (lowerUrl.includes('spec') || lowerUrl.includes('document') || lowerUrl.includes('pdf')) &&
                                !lowerUrl.includes('boq') && 
                                !lowerUrl.includes('buyer')) {
                                console.log('✅ Fallback: gem.gov.in URL in Tech Spec section');
                                return 'GeM Category Specification';
                            }
                        }
                        
                        // THIRD: Check if URL contains obvious specification indicators
                        if (lowerUrl.includes('tech_spec') || 
                            lowerUrl.includes('technical_specification') ||
                            lowerUrl.includes('specification_document')) {
                            if (lowerUrl.includes('boq')) {
                                return 'BOQ Detail Document';
                            }
                            return 'Buyer Specification Document';
                        }
                        
                        console.log('❌ No matching category found');
                        return 'Other';
                    };

                    // Get annotations (which include links)
                    const annotations = await page.getAnnotations();
                    const pageLinks = [];
                    
                    // First pass: Look for "As per GeM Category Specification" text
                    let gemSpecAnnotation = null;
                    for (const annot of annotations) {
                        if (annot.subtype === 'Link') {
                            const linkText = await getContextText(annot.rect);
                            
                            // Enhanced patterns to catch the 3rd format
                            const gemSpecTextPatterns = [
                                'As per GeM Category Specification',
                                'जेम केटेगरी विशिष्टि के अनुसार',
                                '*As per GeM Category Specification',
                                '* जेम केटेगरी विशिष्टि के अनुसार',
                                'As per GeM Category',
                                'जेम केटेगरी विशिष्टि',
                                'GeM Category Specification'
                            ];
                            
                            for (const pattern of gemSpecTextPatterns) {
                                if (linkText.includes(pattern)) {
                                    console.log('✅ Found GeM Category Specification text in annotation:', pattern);
                                    gemSpecAnnotation = annot;
                                    break;
                                }
                            }
                            
                            if (gemSpecAnnotation) break;
                        }
                    }

                    // Second pass: Process all annotations
                    for (const annot of annotations) {
                        if (annot.subtype === 'Link') {
                            // Extract URL from various possible locations
                            let url = annot.url || annot.A?.URI || 
                                    (annot.action && (annot.action.URI || annot.action.Url));
                            
                            if (url) {
                                console.log('Found URL in annotation:', url);
                                
                                // If we found GeM spec text earlier, prioritize URLs near it
                                if (gemSpecAnnotation) {
                                    const distance = Math.abs(annot.rect[1] - gemSpecAnnotation.rect[1]);
                                    if (distance < 100) { // Within 100 units vertically
                                        console.log('URL is near GeM Category Specification text');
                                        pageLinks.push({
                                            url: url,
                                            type: 'GeM Category Specification',
                                            pageNum: i
                                        });
                                        continue;
                                    }
                                }
                            
                            // Get surrounding text context
                            const contextText = await getContextText(annot.rect);
                                
                                // Categorize and store the link
                                pageLinks.push({
                                    url: url,
                                    type: categorizeLink(url, contextText, pageTextStr),
                                    pageNum: i
                                });
                            }
                        }
                    }
                    
                    // Add regex-based URL extraction as fallback
                    const regexTextContent = await page.getTextContent();
                    const regexPageText = regexTextContent.items.map(item => item.str).join(' ');
                    
                    // Enhanced URL regex patterns
                    const urlRegexPatterns = [
                        /(https?:\/\/[^\s)]+)/g,  // Standard HTTP/HTTPS URLs
                        /(https?:\/\/[^\s)]*)/g,  // URLs that might be cut off
                        /(https?:\/\/[^\s)]*\.pdf)/g,  // PDF URLs specifically
                        /(https?:\/\/[^\s)]*\.pdf[^\s)]*)/g  // PDF URLs with additional parameters
                    ];
                    
                    // Check for Technical Specifications section first - with multiple patterns
                    const techSpecPatterns = [
                        'Technical Specifications',
                        'Technical Specifications/',
                        'तकनीकी विशिष्टियाँ',
                        'तकनीकी विशिष्टियाँ/',
                        'Technical Specifications/तकनीकी विशिष्टियाँ'
                    ];
                    
                    let techSpecIndex = -1;
                    let foundTechSpecPattern = '';
                    
                    for (const pattern of techSpecPatterns) {
                        techSpecIndex = regexPageText.indexOf(pattern);
                        if (techSpecIndex !== -1) {
                            foundTechSpecPattern = pattern;
                            break;
                        }
                    }
                    
                    if (techSpecIndex !== -1) {
                        console.log(`✅ Found "Technical Specifications" on page ${i} with pattern: "${foundTechSpecPattern}"`);
                        
                        // Get text after Technical Specifications
                        const afterTechSpec = regexPageText.substring(techSpecIndex, techSpecIndex + 1000);
                        console.log(`📄 Tech Spec section text: ${afterTechSpec.substring(0, 200)}...`);
                        
                        // Check for GeM Category Specification text in the section
                        const gemPatterns = [
                            'As per GeM Category Specification',
                            'जेम केटेगरी विशिष्टि के अनुसार',
                            '*As per GeM Category Specification',
                            '* जेम केटेगरी विशिष्टि के अनुसार',
                            'जेम केटेगरी विशिष्टि',
                            'GeM Category Specification',
                            'जेम केटेगरी',
                            'GeM Category'
                        ];
                        
                        let foundGemText = false;
                        for (const pattern of gemPatterns) {
                            if (afterTechSpec.includes(pattern)) {
                                console.log(`✅ Found GeM text in Tech Spec section: "${pattern}"`);
                                foundGemText = true;
                                break;
                            }
                        }
                        
                        if (!foundGemText) {
                            console.log(`❌ No GeM Category Specification text found in Tech Spec section`);
                        }
                        
                        // Look for URLs specifically in the Technical Specifications section
                        for (const urlRegex of urlRegexPatterns) {
                            let match;
                            while ((match = urlRegex.exec(afterTechSpec)) !== null) {
                                const url = match[1];
                                console.log(`🔗 Found URL in Technical Specifications: ${url}`);
                                
                                // Get context around the URL in the section
                                const start = Math.max(0, match.index - 100);
                                const end = Math.min(afterTechSpec.length, match.index + url.length + 100);
                                const contextText = afterTechSpec.substring(start, end);
                                
                                // Check if URL was already found
                                if (!pageLinks.some(link => link.url === url)) {
                                    const linkType = categorizeLink(url, contextText, afterTechSpec);
                                    console.log(`📋 Categorized as: ${linkType}`);
                                    
                                    pageLinks.push({
                                        url: url,
                                        type: linkType,
                                        pageNum: i
                                    });
                                }
                            }
                        }
                    } else {
                        console.log(`❌ No Technical Specifications section found on page ${i}`);
                        
                        // Fallback: Check entire page for GeM Category Specification patterns
                        const gemPatterns = [
                            'As per GeM Category Specification',
                            'जेम केटेगरी विशिष्टि के अनुसार',
                            '*As per GeM Category Specification',
                            '* जेम केटेगरी विशिष्टि के अनुसार',
                            'जेम केटेगरी विशिष्टि',
                            'GeM Category Specification'
                        ];
                        
                        for (const pattern of gemPatterns) {
                            if (regexPageText.includes(pattern)) {
                                console.log(`✅ Found GeM pattern in full page text: "${pattern}"`);
                                
                                // Look for URLs near this pattern
                                const patternIndex = regexPageText.indexOf(pattern);
                                const start = Math.max(0, patternIndex - 200);
                                const end = Math.min(regexPageText.length, patternIndex + pattern.length + 200);
                                const contextText = regexPageText.substring(start, end);
                                
                                // Look for URLs in this context
                                for (const urlRegex of urlRegexPatterns) {
                                    let match;
                                    while ((match = urlRegex.exec(contextText)) !== null) {
                                        const url = match[1];
                                        console.log(`🔗 Found URL near GeM pattern: ${url}`);
                                        
                                        if (!pageLinks.some(link => link.url === url)) {
                                            const linkType = categorizeLink(url, contextText, regexPageText);
                                            console.log(`📋 Categorized as: ${linkType}`);
                                            
                                            pageLinks.push({
                                                url: url,
                                                type: linkType,
                                                pageNum: i
                                            });
                                        }
                                    }
                                }
                                break;
                            }
                        }
                    }
                    
                    // Also check the entire page text for any URLs we might have missed
                    for (const urlRegex of urlRegexPatterns) {
                        let match;
                        while ((match = urlRegex.exec(regexPageText)) !== null) {
                            const url = match[1];
                            
                            // Check if URL was already found
                            if (!pageLinks.some(link => link.url === url)) {
                                // Get context around the URL
                                const start = Math.max(0, match.index - 100);
                                const end = Math.min(regexPageText.length, match.index + url.length + 100);
                                const contextText = regexPageText.substring(start, end);
                                
                                const linkType = categorizeLink(url, contextText, regexPageText);
                                console.log(`🔗 Found URL: ${url} -> ${linkType}`);
                                
                                pageLinks.push({
                                    url: url,
                                    type: linkType,
                                    pageNum: i
                                });
                            }
                        }
                    }
                    
                    links.push(...pageLinks);
                    
                    // Get structured content (might include link elements)
                    const structTree = await page.getStructTree();
                    if (structTree) {
                        const extractLinks = (node) => {
                            if (node.url) {
                                links.push({
                                    url: node.url,
                                    pageNum: i
                                });
                            }
                            if (node.kids) {
                                node.kids.forEach(extractLinks);
                            }
                        };
                        structTree.forEach(extractLinks);
                    }
                    
                } catch (pageError) {
                    console.warn(`Error processing page ${i}:`, pageError);
                    fullText += `[Page ${i} processing error]\n`;
                }
            }
            
            // Store links in the instance for use in extractTechnicalSpec
            this.pdfLinks = links;

            // Store positioned text for the bid-details table reader
            this.pdfPositionedPages = positionedPages;
            this.bidDetailRowsCache = null;

            // IMPROVED: Validate extracted text
            if (!fullText || fullText.trim().length < 100) {
                throw new Error('PDF appears to contain insufficient text content. It may be a scanned document or image-based PDF.');
            }

            // IMPROVED: Check for common GeM bidding keywords
            const gemKeywords = ['GeM', 'Bidding', 'बिड', 'Item Category', 'मद केटेगरी', 'Technical Specifications'];
            const hasGemContent = gemKeywords.some(keyword => fullText.includes(keyword));
            
            if (!hasGemContent) {
                console.warn('PDF may not be a GeM bidding document. Extraction may be incomplete.');
            }

            // Organization Name extraction will be handled by extractOrganizationName function

            // DEBUG: Show what we're processing
            this.debugExtraction(fullText, file.name);

            // Extract data using the IMPROVED LOGIC
            const extractedData = this.extractDataFromText(fullText, file.name);
            
            // IMPROVED: Validate extracted data
            const validationResult = this.validateExtractedData(extractedData);
            if (!validationResult.isValid) {
                console.warn('Data validation warnings:', validationResult.warnings);
            }
            
            return extractedData;
            
        } catch (error) {
            console.error('Error processing PDF:', error);
            
            // IMPROVED: Better error messages for users
            if (error.message.includes('insufficient text content')) {
                this.showStatus('This PDF appears to be a scanned document or image. Please use a PDF with extractable text.', 'error');
            } else if (error.message.includes('PDF.js library not loaded')) {
                this.showStatus('PDF processing library is still loading. Please wait and try again.', 'error');
            } else {
                this.showStatus('PDF processing failed. Please ensure the file contains extractable text and is not corrupted.', 'error');
            }
            
            throw error;
        }
    }

    // NEW FUNCTION: extractBIDNumber - Extract bid number from PDF content
    extractBIDNumber(text) {
        // Look for bid number patterns like "GEM/2025/B/5918811"
        const bidNumberPatterns = [
            /Bid\s+Number[:\s]*([A-Z]+\/\d{4}\/[A-Z]+\/\d+)/i,
            /बोली\s+क्रमांक[:\s]*([A-Z]+\/\d{4}\/[A-Z]+\/\d+)/i,
            /बिड\s+संख्या[:\s]*([A-Z]+\/\d{4}\/[A-Z]+\/\d+)/i,
            /GEM\/\d{4}\/[A-Z]+\/\d+/gi,
            /([A-Z]+\/\d{4}\/[A-Z]+\/\d+)/g
        ];
        
        for (const pattern of bidNumberPatterns) {
            const match = text.match(pattern);
            if (match) {
                const bidNumber = match[1] || match[0];
                console.log('Found BID Number:', bidNumber);
                return bidNumber;
            }
        }
        
        // Fallback: look for any GEM pattern
        const gemPattern = /GEM\/\d{4}\/[A-Z]+\/\d+/i;
        const gemMatch = text.match(gemPattern);
        if (gemMatch) {
            console.log('Found GEM pattern:', gemMatch[0]);
            return gemMatch[0];
        }
        
        console.log('No BID Number found, using default');
        return 'GEM/2025/B/XXXXXXX'; // Default fallback
    }

    // NEW FUNCTION: extractMinistry - Extract ministry name from PDF table structure
    extractMinistry(text) {
        // Look for Ministry/State Name patterns in the bid details table
        const ministryPatterns = [
            /Ministry\s+Of\s+[A-Za-z\s&]+/i,
            /Ministry\s+[A-Za-z\s&]+/i,
            /Department\s+Of\s+[A-Za-z\s&]+/i
        ];

        for (const pattern of ministryPatterns) {
            const match = text.match(pattern);
            if (match) {
                let ministry = match[0].trim();
                
                // Clean up the ministry name - remove field labels
                ministry = ministry.replace(/\s*Ministry\/State\s+Name\s*$/i, '');
                ministry = ministry.replace(/\s*Department\s+Name\s*$/i, '');
                ministry = ministry.replace(/\s*Organisation\s+Name\s*$/i, '');
                ministry = ministry.replace(/\s*Office\s+Name\s*$/i, '');
                ministry = ministry.replace(/\s*Buyer\s+Email\s*$/i, '');
                
                // Remove any trailing commas or extra spaces
                ministry = ministry.replace(/[,\s]+$/, '').trim();
                
                if (ministry.length > 5) {
                    console.log('Found ministry:', ministry);
                    return ministry;
                }
            }
        }
        
        // Fallback: look for specific ministry patterns
        const specificMinistries = [
            'Ministry of Coal',
            'Ministry of Defence', 
            'Ministry of Petroleum and Natural Gas',
            'Ministry of Commerce and Industry'
        ];
        
        for (const ministry of specificMinistries) {
            if (text.includes(ministry)) {
                console.log('Found ministry from pattern:', ministry);
                return ministry;
            }
        }
        
        console.log('No ministry found, using default');
        return 'Ministry of Defence';
    }

    // UPDATED: extractOrganizationName - Use same approach as extractBuyer
    extractOrganizationName(text) {
        // Look for Organisation Name patterns in the bid details table
        const organizationPatterns = [
            /Organisation\s+Name[:\s]*([A-Za-z\s&]+)/i,
            /Organization\s+Name[:\s]*([A-Za-z\s&]+)/i,
            /संगठन\s+का\s+नाम[:\s]*([A-Za-z\s&]+)/i
        ];

        for (const pattern of organizationPatterns) {
            const match = text.match(pattern);
            if (match) {
                let organization = match[1].trim();
                
                // Clean up the organization name
                organization = organization.replace(/\s*Office\s+Name\s*$/i, '');
                organization = organization.replace(/\s*Buyer\s+Email\s*$/i, '');
                organization = organization.replace(/[,\s]+$/, '').trim();
                
                if (organization.length > 3) {
                    console.log('Found organization:', organization);
                    return organization;
                }
            }
        }
        
        // Fallback: look for specific organization patterns
        const specificOrganizations = [
            'Indian Navy',
            'Indian Army', 
            'Indian Air Force',
            'Goa Shipyard Limited',
            'Hpcl Rajasthan Refinery Limited'
        ];
        
        for (const org of specificOrganizations) {
            if (text.includes(org)) {
                console.log('Found organization from pattern:', org);
                return org;
            }
        }
        
        console.log('No organization found, using default');
        return '-';
    }

    // UPDATED: extractBuyer - Keep the same approach but clean up the logic
    extractBuyer(text) {
        // Look for Department Name patterns in the bid details table
        const departmentPatterns = [
            /Department\s+Of\s+[A-Za-z\s&]+/i,
            /Department\s+[A-Za-z\s&]+/i
        ];

        for (const pattern of departmentPatterns) {
            const match = text.match(pattern);
            if (match) {
                let buyer = match[0].trim();
                
                // Clean up the buyer name - remove field labels
                buyer = buyer.replace(/\s*Department\s+Name\s*$/i, '');
                buyer = buyer.replace(/\s*Organisation\s+Name\s*$/i, '');
                buyer = buyer.replace(/\s*Office\s+Name\s*$/i, '');
                buyer = buyer.replace(/\s*Buyer\s+Email\s*$/i, '');
                
                // Remove any trailing commas or extra spaces
                buyer = buyer.replace(/[,\s]+$/, '').trim();
                
                if (buyer.length > 5) {
                    console.log('Found buyer:', buyer);
                    return buyer;
                }
            }
        }
        
        // Fallback: look for specific department patterns
        const specificDepartments = [
            'Department of Military Affairs',
            'Department of Defence Production',
            'Department of Petroleum and Natural Gas'
        ];
        
        for (const dept of specificDepartments) {
            if (text.includes(dept)) {
                console.log('Found department from pattern:', dept);
                return dept;
            }
        }
        
        console.log('No buyer found, using default');
        return 'Department of Military Affairs';
    }

    // UPDATED: extractDataFromText - Add Ministry column and use new extraction functions
    extractDataFromText(text, filename) {
        // Extract BID number from PDF content (not filename)
        const bidNumber = this.extractBIDNumber(text);
        
        // Extract data using the SAME regex patterns as our Python script
        const data = {
            'BID Number': bidNumber,
            'Ministry': this.fromBidDetailsOr('Ministry', /Ministry\s*\/\s*State\s+Name/i, null,
                () => this.extractMinistry(text)),
            'Buyer': this.fromBidDetailsOr('Department', /Department\s+Name/i, null,
                () => this.extractBuyer(text)),
            'BID Start Date': this.extractBIDStartDate(text),
            // the cell also holds the time ("03-01-2025 15:00:00"); the column is the date
            'BID End Date': this.fromBidDetailsOr('BID End Date', /Bid\s+End\s+Date/i,
                cell => (cell.match(/\d{2}-\d{2}-\d{4}/) || [''])[0],
                () => this.extractBIDEndDate(text)),
            'Organization Name': this.fromBidDetailsOr('Organization Name', /Organisation\s+Name/i, null,
                () => this.extractOrganizationName(text)),
            'Total Quantity': this.fromBidDetailsOr('Total Quantity', /Total\s+Quantity/i,
                cell => (cell.match(/\d[\d,]*/) || [''])[0].replace(/,/g, ''),
                () => this.extractTotalQuantity(text)),
            // the PDF separates the items with " , "; the column separates them with " | "
            'Item Category': this.fromBidDetailsOr('Item Category', /Item\s+Category/i,
                cell => cell.replace(/\s+\|\s+/g, ' ').split(/\s+,(?:\s+|$)/).map(item => item.trim()).filter(item => item).join(' | '),
                () => this.extractItemCategory(text)),
            'Searched Strings used in GeMARPTS': this.extractGeMARPTSSearchedStrings(),
            'Searched Result generated in GeMARPTS': this.extractGeMARPTSSearchedResult(),
            'Relevant Categories selected for notification': this.extractRelevantCategories(),
            'BOQ Title': this.extractBOQTitle(),
            'Technical Specification': this.extractTechnicalSpec(text),
            'Filename': filename // NEW: Add filename as last column
        };

        console.log('Extracted data:', data);
        return data;
    }

    // FIXED: extractBIDStartDate - Extract the "Dated" field from top right of PDF
    extractBIDStartDate(text) {
        // Look for the "Dated" field (top right of PDF header) with multiple formats
        const datedPatterns = [
            /Dated\s*:\s*(\d{2}-\d{2}-\d{4})/i,
            /Dated\/\s*दिनांक\s*:\s*(\d{2}-\d{2}-\d{4})/i,
            /दिनांक\s*:\s*(\d{2}-\d{2}-\d{4})/i,
            /Date\s*:\s*(\d{2}-\d{2}-\d{4})/i,
            /Dated\s*\/\s*[^\s]*\s*:\s*(\d{2}-\d{2}-\d{4})/i  // Dated/anything : date
        ];
        
        for (const pattern of datedPatterns) {
            const match = text.match(pattern);
            if (match) {
                const date = match[1];
                console.log('Found BID Start Date (Dated field):', date);
                return date;
            }
        }
        
        // Look for the specific format from the PDF: "Dated/दिनांक : 12-02-2025"
        const specificPattern = /Dated\s*\/\s*[^\s]*\s*[^\s]*\s*:\s*(\d{2}-\d{2}-\d{4})/i;
        const specificMatch = text.match(specificPattern);
        if (specificMatch) {
            const date = specificMatch[1];
            console.log('Found BID Start Date (specific Dated/दिनांक format):', date);
            return date;
        }
        
        // Look for date patterns near "Dated" or "दिनांक" keywords
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('Dated') || line.includes('दिनांक')) {
                // Look for DD-MM-YYYY pattern in this line or nearby lines
                const dateMatch = line.match(/(\d{2}-\d{2}-\d{4})/);
                if (dateMatch) {
                    const date = dateMatch[1];
                    console.log('Found BID Start Date near Dated keyword:', date);
                    return date;
                }
                
                // Check next few lines for date
                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    const nextLine = lines[j];
                    const nextDateMatch = nextLine.match(/(\d{2}-\d{2}-\d{4})/);
                    if (nextDateMatch) {
                        const date = nextDateMatch[1];
                        console.log('Found BID Start Date in next line after Dated:', date);
                        return date;
                    }
                }
            }
        }
        
        // Fallback: look for any DD-MM-YYYY format in the first 20 lines (header area)
        for (let i = 0; i < Math.min(20, lines.length); i++) {
            const line = lines[i];
            const dateMatch = line.match(/(\d{2}-\d{2}-\d{4})/);
            if (dateMatch) {
                const date = dateMatch[1];
                console.log('Found fallback date in header area:', date);
                return date;
            }
        }
        
        console.log('No BID Start Date found, using default');
        return '01-03-2025'; // Default fallback
    }

    // NEW FUNCTION: extractBIDEndDate - Extract the "Bid End Date" field from PDF
    extractBIDEndDate(text) {
        // Look for the "Bid End Date" field with multiple formats
        const endDatePatterns = [
            /Bid\s+End\s+Date[:\s]*(\d{2}-\d{2}-\d{4})/i,
            /बिड\s+बंद\s+होने\s+की\s+तारीख[:\s]*(\d{2}-\d{2}-\d{4})/i,
            /Bid\s+End\s+Date\/\s*बिड\s+बंद\s+होने\s+की\s+तारीख[:\s]*(\d{2}-\d{2}-\d{4})/i,
            /End\s+Date[:\s]*(\d{2}-\d{2}-\d{4})/i,
            /बंद\s+होने\s+की\s+तारीख[:\s]*(\d{2}-\d{2}-\d{4})/i
        ];
        
        for (const pattern of endDatePatterns) {
            const match = text.match(pattern);
            if (match) {
                const date = match[1];
                console.log('Found BID End Date:', date);
                return date;
            }
        }
        
        // Look for date patterns near "Bid End Date" or "बिड बंद होने की तारीख" keywords
        const lines = text.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('Bid End Date') || line.includes('बिड बंद होने की तारीख') || 
                line.includes('End Date') || line.includes('बंद होने की तारीख')) {
                // Look for DD-MM-YYYY pattern in this line or nearby lines
                const dateMatch = line.match(/(\d{2}-\d{2}-\d{4})/);
                if (dateMatch) {
                    const date = dateMatch[1];
                    console.log('Found BID End Date near keyword:', date);
                    return date;
                }
                
                // Check next few lines for date
                for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) {
                    const nextLine = lines[j];
                    const nextDateMatch = nextLine.match(/(\d{2}-\d{2}-\d{4})/);
                    if (nextDateMatch) {
                        const date = nextDateMatch[1];
                        console.log('Found BID End Date in next line after keyword:', date);
                        return date;
                    }
                }
            }
        }
        
        console.log('No BID End Date found');
        return 'Not Found';
    }

    // NEW FUNCTION: calculateDaysPending - Calculate days remaining until bid expiry
    calculateDaysPending(endDateStr) {
        try {
            if (!endDateStr || endDateStr === 'Not Found') {
                return 'N/A';
            }
            
            // Parse the end date (DD-MM-YYYY format)
            const endDateParts = endDateStr.split('-');
            if (endDateParts.length !== 3) {
                return 'Invalid Date';
            }
            
            const endDate = new Date(
                parseInt(endDateParts[2]), // Year
                parseInt(endDateParts[1]) - 1, // Month (0-indexed)
                parseInt(endDateParts[0]) // Day
            );
            
            if (isNaN(endDate.getTime())) {
                return 'Invalid Date';
            }
            
            // Get current date (set to start of day for accurate calculation)
            const currentDate = new Date();
            currentDate.setHours(0, 0, 0, 0);
            
            // Calculate difference in days
            const timeDiff = endDate.getTime() - currentDate.getTime();
            const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
            
            if (daysDiff < 0) {
                return 'Expired';
            } else if (daysDiff === 0) {
                return 'Expires Today';
            } else {
                return `${daysDiff} days`;
            }
            
        } catch (error) {
            console.warn('Error calculating days pending:', error);
            return 'Calculation Error';
        }
    }




    


    // IMPROVED LOGIC: extractTotalQuantity - Better quantity extraction from electrical components
    extractTotalQuantity(text) {
        const lines = text.split('\n');
        let totalQuantity = 0;
        
        // Look for quantities in the electrical components section
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.includes('VARIOUS TYPES OF ELECTRICAL SPARES') || 
                line.includes('Item Category/') || 
                line.includes('मद केटेगरी') ||
                (line.includes('Bid Details') && line.includes('बिड विवरण'))) {
                
                // Look ahead for quantity information
                for (let j = i + 1; j < Math.min(i + 50, lines.length); j++) {
                    const currentLine = lines[j].trim();
                    
                    // Stop if we hit policy sections
                    if (['Experience Criteria', 'Preference to Make In India', 'Purchase preference for MSEs', 
                         'Estimated Bid Value', 'Past Performance', 'Technical Specifications',
                         'Consignees/Reporting Officer', 'Buyer Added Bid', 'Input Tax Credit'].some(stop => 
                         currentLine.includes(stop))) {
                        break;
                    }
                    
                    // Look for quantity patterns in electrical component descriptions
                    const qtyPatterns = [
                        /(\d+)\s*Nos?/gi,
                        /(\d+)\s*Units?/gi,
                        /(\d+)\s*Pieces?/gi,
                        /(\d+)\s*Sets?/gi,
                        /(\d+)\s*Meters?/gi,
                        /(\d+)\s*Mtr/gi,
                        /(\d+)\s*Rolls?/gi,
                        /(\d+)\s*Boxes?/gi
                    ];
                    
                    for (const pattern of qtyPatterns) {
                        const matches = currentLine.match(pattern);
                        if (matches) {
                            const qty = parseInt(matches[1]);
                            if (qty > 0 && qty <= 999999) {
                                totalQuantity += qty;
                            }
                        }
                    }
                }
                break;
            }
        }
        
        // If we found quantities from components, return the total
        if (totalQuantity > 0) {
            return totalQuantity.toString();
        }
        
        // Fallback: Look for traditional quantity patterns
        const quantityPatterns = [
            /Total\s+Quantity\/कुल\s+मात्रा\s*[:\-]?\s*(\d+)/i,
            /Total\s+Quantity.*?[:\-]?\s*(\d{2,6})/i,
            /कुल\s+मात्रा\s*[:\-]?\s*(\d+)/i,
            /Quantity.*?[:\-]?\s*(\d{2,6})/i,
            /Total\s+Qty.*?[:\-]?\s*(\d+)/i,
            /Qty.*?[:\-]?\s*(\d+)/i
        ];
        
        for (const pattern of quantityPatterns) {
            const match = text.match(pattern);
            if (match) {
                const qty = parseInt(match[1]);
                if (1 <= qty && qty <= 999999) {
                    return qty.toString();
                }
            }
        }
        
        return 'Not Found';
    }

    // IMPROVED: extractItemCategory - Better extraction of specific product names like "Schneider Electric Compact"
    extractItemCategory(text) {
        const lines = text.split('\n');
        const items = [];
        
        // Look for the actual item list section
        let inItemSection = false;
        let foundItems = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Look for the start of actual item specifications
            if (line.includes('Item Category/') || 
                line.includes('मद केटेगरी') ||
                line.includes('VARIOUS TYPES OF ELECTRICAL SPARES') ||
                line.includes('CIRCUIT BREAKER') ||
                line.includes('Schneider Electric') ||
                line.includes('Bid Details') && line.includes('बिड विवरण')) {
                
                inItemSection = true;
                console.log('Found item section at line:', i, 'Content:', line);
                continue;
            }
            
            if (inItemSection) {
                const lineClean = line.trim();
                
                // Stop when we hit policy sections or other non-item content
                if (['Experience Criteria', 'Preference to Make In India', 'Purchase preference for MSEs', 
                     'Estimated Bid Value', 'Past Performance', 'Technical Specifications',
                     'Consignees/Reporting Officer', 'Buyer Added Bid', 'Input Tax Credit',
                     'EMD Detail', 'Evaluation Method', 'Inspection Required', 'Advisory',
                     'Searched Strings', 'Relevant Categories', 'MSE Exemption'].some(stop => 
                     lineClean.includes(stop))) {
                    console.log('Stopping at line:', i, 'due to:', lineClean);
                    break;
                }
                
                // Skip empty lines, page numbers, and noise
                if (lineClean && 
                    !/^\d+\s*\/\s*\d+$/.test(lineClean) &&
                    !lineClean.includes('GeMARPTS') &&
                    !lineClean.includes('Strings used in') &&
                    !lineClean.includes('Result generated') &&
                    !lineClean.includes('Categories selected') &&
                    !lineClean.startsWith('मम') &&
                    !lineClean.startsWith('अधिसूचना') &&
                    lineClean.length > 10 &&
                    !lineClean.includes('Policy') &&
                    !lineClean.includes('criteria') &&
                    !lineClean.includes('preference') &&
                    !lineClean.includes('percentage') &&
                    !lineClean.includes('registration') &&
                    !lineClean.includes('financial year') &&
                    !lineClean.includes('Advisory') &&
                    !lineClean.includes('Department Name') &&
                    !lineClean.includes('Organisation Name') &&
                    !lineClean.includes('Office Name') &&
                    !lineClean.includes('Buyer Email')) {
                    
                    // Clean up the line
                    let cleanLine = lineClean;
                    cleanLine = cleanLine.replace(/^\d+\.\s*/, ''); // Remove numbering
                    cleanLine = cleanLine.replace(/^[^\w\s]*\s*/, ''); // Remove special chars at start
                    cleanLine = cleanLine.replace(/\s+/g, ' ').trim(); // Normalize spaces
                    
                    if (cleanLine.length > 10 && cleanLine.length < 300) {
                        // Check if this looks like an actual item (not policy text)
                        const hasItemIndicators = 
                            cleanLine.includes('PART NO.') ||
                            cleanLine.includes('CIRCUIT BREAKER') ||
                            cleanLine.includes('Schneider Electric') ||
                            cleanLine.includes('Compact') ||
                            cleanLine.includes('Switch') ||
                            cleanLine.includes('Socket') ||
                            cleanLine.includes('Plug') ||
                            cleanLine.includes('Holder') ||
                            cleanLine.includes('Cable') ||
                            cleanLine.includes('Lamp') ||
                            cleanLine.includes('Light') ||
                            cleanLine.includes('Contactor') ||
                            cleanLine.includes('Relay') ||
                            cleanLine.includes('Timer') ||
                            cleanLine.includes('Diode') ||
                            cleanLine.includes('Insulation') ||
                            cleanLine.includes('Capacitor') ||
                            cleanLine.includes('Volt') ||
                            cleanLine.includes('Amp') ||
                            cleanLine.includes('Watt') ||
                            cleanLine.includes('sq.mm') ||
                            cleanLine.includes('mFD') ||
                            cleanLine.includes('Hz') ||
                            cleanLine.includes('Phase') ||
                            cleanLine.includes('Pole') ||
                            cleanLine.includes('Range') ||
                            cleanLine.includes('Make') ||
                            cleanLine.includes('Brand') ||
                            cleanLine.includes('Model') ||
                            cleanLine.includes('Type') ||
                            cleanLine.includes('pieces') ||
                            cleanLine.includes('units') ||
                            cleanLine.includes('nos') ||
                            cleanLine.includes('quantity') ||
                            cleanLine.includes('qty');
                        
                        if (hasItemIndicators) {
                            items.push(cleanLine);
                            foundItems = true;
                            console.log('Found item:', cleanLine);
                        }
                    }
                }
            }
        }
        
        // If we didn't find items in the main section, look for specific patterns
        if (!foundItems) {
            console.log('No categorized items found, looking for specific patterns...');
            
            // Look for Schneider Electric patterns
            const schneiderPatterns = [
                /Schneider\s+Electric\s+[A-Za-z\s]+\(\s*\d+\s*pieces?\s*\)/gi,
                /Schneider\s+Electric\s+[A-Za-z\s]+/gi,
                /Compact\s*\(\s*\d+\s*pieces?\s*\)/gi
            ];
            
            for (const pattern of schneiderPatterns) {
                const matches = text.match(pattern);
                if (matches) {
                    items.push(...matches);
                    foundItems = true;
                    console.log('Found Schneider Electric pattern:', matches);
                }
            }
            
            // Look for circuit breaker patterns
            const circuitBreakerPatterns = [
                /CIRCUIT\s+BREAKER\s+[A-Z\s]+PART\s+NO\.\s+[A-Z0-9]+/gi,
                /Circuit\s+Breaker\s+[A-Za-z\s]+Part\s+No\.\s+[A-Z0-9]+/gi,
                /[A-Z]+\s+PART\s+NO\.\s+[A-Z0-9]+/gi
            ];
            
            for (const pattern of circuitBreakerPatterns) {
                const matches = text.match(pattern);
                if (matches) {
                    items.push(...matches);
                    foundItems = true;
                    console.log('Found circuit breaker pattern:', matches);
                }
            }
            
            // Look for other electrical component patterns
            const electricalPatterns = [
                /Switch.*?Socket.*?\d+V.*?\d+A/gi,
                /Plug.*?Top.*?\d+A/gi,
                /Holder.*?BC.*?Brass/gi,
                /Insulation.*?Tape.*?\d+.*?Mtr/gi,
                /Capacitor.*?\d+.*?mFD.*?\d+V/gi,
                /Tube.*?Light.*?Holder/gi,
                /Lamp.*?\d+V.*?\d+W/gi,
                /Cable.*?\d+.*?sq\.mm.*?Copper/gi,
                /Contactor.*?\d+V.*?Coil/gi,
                /Relay.*?range.*?\d+.*?\d+A/gi,
                /Timer.*?Range.*?\d+.*?\d+S/gi,
                /Diode.*?battery.*?Charge/gi,
                /Cable.*?Lugs.*?SIZE.*?\d+.*?Sq\.mm/gi
            ];
            
            for (const pattern of electricalPatterns) {
                const matches = text.match(pattern);
                if (matches) {
                    items.push(...matches);
                    foundItems = true;
                }
            }
        }
        
        // Format the found items
        if (items.length > 0) {
            // Clean and deduplicate items
            const cleanItems = [...new Set(items)]
                .filter(item => item.length > 10 && item.length < 300)
                .slice(0, 20); // Limit to first 20 items
            
            console.log('Found items:', cleanItems.length);
            return cleanItems.join(' | ');
        }
        
        console.log('No items found');
        return 'No items found - may be policy document or scanned image';
    }

    // NEW FUNCTIONS: the four bid-details rows that sit together under Item Category
    //   GeMARPTS में खोजी गई स्ट्रिंग / Searched Strings used in GeMARPTS
    //   GeMARPTS में खोजा गया परिणाम / Searched Result generated in GeMARPTS
    //   अधिसूचना के लिए चयनित प्रासंगिक श्रेणियाँ / Relevant Categories selected for notification
    //   BOQ Title/बीओक्यू शीर्षक
    // Rows are found by the English part of their label (the Hindi part comes out of PDF.js
    // scrambled) and their values are read by position on the page - see buildBidDetailRows.
    extractGeMARPTSSearchedStrings() {
        return this.getBidDetailValue('Searched Strings used in GeMARPTS', /Searched\s+Strings?\s+used\s+in/i);
    }

    extractGeMARPTSSearchedResult() {
        return this.getBidDetailValue('Searched Result generated in GeMARPTS', /Searched\s+Results?\s+generated\s+in/i);
    }

    extractRelevantCategories() {
        return this.getBidDetailValue('Relevant Categories selected for notification', /Relevant\s+Categor(?:y|ies)\s+selected/i);
    }

    extractBOQTitle() {
        return this.getBidDetailValue('BOQ Title', /BOQ\s+Title/i);
    }

    // Text of the bid-details cell whose label matches labelRegex ('' if the row is not in
    // the PDF or its value is blank)
    readBidDetailCell(labelRegex) {
        if (!this.bidDetailRowsCache) {
            try {
                this.bidDetailRowsCache = this.buildBidDetailRows();
            } catch (error) {
                console.warn('Could not read the bid-details table by position:', error);
                this.bidDetailRowsCache = [];
            }
        }
        const row = this.bidDetailRowsCache.find(r => labelRegex.test(r.label));
        return row && row.value ? row.value : '';
    }

    // Excel refuses cells longer than 32,767 characters, and one oversized cell would stop
    // the whole workbook from being written
    fitExcelCell(fieldName, value) {
        const excelCellLimit = 32767;
        const cutNote = ' ... [cut here: Excel allows 32,767 characters per cell]';
        if (value.length <= excelCellLimit) return value;
        console.warn(`${fieldName}: ${value.length} characters, cut to fit an Excel cell`);
        return value.substring(0, excelCellLimit - cutNote.length) + cutNote;
    }

    // Value of the bid-details row whose label matches labelRegex, or 'Not Found'
    getBidDetailValue(fieldName, labelRegex) {
        const value = this.readBidDetailCell(labelRegex);
        if (!value) {
            console.log(`${fieldName}: row not present in this PDF, or its value is blank`);
            return 'Not Found';
        }
        console.log(`Found ${fieldName}:`, value.length > 200 ? value.substring(0, 200) + '...' : value);
        return this.fitExcelCell(fieldName, value);
    }

    // Columns that existed before the table reader: take the value straight from the row of
    // the bid-details table when the row is there, and only otherwise fall back to the
    // older text search. tidy() turns the cell text into the form the column uses.
    fromBidDetailsOr(fieldName, labelRegex, tidy, fallback) {
        const cell = this.readBidDetailCell(labelRegex);
        const value = cell ? (tidy ? tidy(cell) : cell) : '';
        if (value) {
            console.log(`${fieldName} (from the bid-details table):`, value.length > 200 ? value.substring(0, 200) + '...' : value);
            return this.fitExcelCell(fieldName, value);
        }
        console.log(`${fieldName}: not found in the bid-details table, using text search`);
        return fallback();
    }

    // Reads the two-column bid-details table (label on the left, value on the right) using
    // the position of the text on the page. Returns [{ label, value }] in table order.
    //
    // Reading the flat page text is not enough for GeM PDFs:
    //  - a value cell can run over several pages, with page headers and footers in between
    //  - the label is printed at the vertical middle of its row, so for a row that spans
    //    pages the label can appear pages after the value starts
    //  - the Hindi half of every label comes out scrambled, mixed with digits and symbols
    buildBidDetailRows() {
        const allPages = this.pdfPositionedPages || [];
        if (allPages.length === 0) return [];

        // Where the two columns start: labels at the left margin, values at the most used
        // position well to the right of it. Page 1 (where the table begins) normally settles
        // this; more pages are looked at only if that does not produce a readable table.
        const findColumns = (pageList) => {
            const counts = new Map();
            pageList.forEach(page => page.items.forEach(it => {
                const key = Math.round(it.x);
                counts.set(key, (counts.get(key) || 0) + 1);
            }));
            const xPositions = [...counts.keys()].sort((a, b) => a - b);
            const left = xPositions.find(x => counts.get(x) >= 3);
            if (left === undefined) return null;
            let right;
            xPositions.filter(x => x >= left + 100).forEach(x => {
                if (right === undefined || counts.get(x) > counts.get(right)) right = x;
            });
            return right === undefined || counts.get(right) < 3 ? null : { labelX: left, valueX: right };
        };
        const tried = [];
        for (const pageList of [allPages.slice(0, 1), allPages.slice(0, 3), allPages]) {
            const columns = findColumns(pageList);
            if (!columns || tried.includes(columns.labelX + ':' + columns.valueX)) continue;
            tried.push(columns.labelX + ':' + columns.valueX);
            const rows = this.readBidDetailTable(allPages, columns.labelX, columns.valueX);
            if (rows.length > 0) return rows;
        }
        return [];
    }

    // The table reader itself, for label and value columns starting at labelX and valueX
    readBidDetailTable(allPages, labelX, valueX) {
        // The rows of the table that feed a column of the Excel sheet
        const wantedLabels = [
            /Bid\s+End\s+Date/i, /Ministry\s*\/\s*State\s+Name/i, /Department\s+Name/i, /Organisation\s+Name/i,
            /Total\s+Quantity/i, /Item\s+Category/i,
            /Searched\s+Strings?\s+used\s+in/i, /Searched\s+Results?\s+generated\s+in/i,
            /Relevant\s+Categor(?:y|ies)\s+selected/i, /BOQ\s+Title/i
        ];
        const targetLabel = { test: (labelText) => wantedLabels.some(label => label.test(labelText)) };
        // second line of the three labels that are printed on two lines
        const targetLabelEnd = /^(?:Strings?\s+used\s+in|Results?\s+generated\s+in|Categor(?:y|ies)\s+selected)/i;
        const lineTolerance = 3.5;    // items this close vertically are on the same line
        const labelBlockGap = 18;     // lines of one label are closer than this, separate labels are further apart
        const anchorReach = 12;       // how far from a label's middle its nearest value line may be
        const linePitch = 11.25;
        const driftPerPageBreak = 1.5;      // text of a long cell drifts down a little at every page break...
        const driftTolerancePerBreak = 2;   // ...by an amount that varies, so allow this much either way
        const mergeGain = 8;                // how much better the fit must get to treat two label pieces as one
        const sureAnchorReach = 6.5;        // a value line this close to a label's middle is certainly its own
        const blankGain = 5;                // how much better the fit must get to treat a doubtful row as blank

        const splitX = valueX - 4;

        // --- 1. Turn each page into label lines and value lines
        const toLines = (items) => {
            const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
            const lines = [];
            sorted.forEach(it => {
                const last = lines[lines.length - 1];
                const offset = last ? Math.abs(last.y - it.y) : Infinity;
                // Slightly different baselines still make one line (Hindi and English text
                // sit a little apart), but not when the pieces would overlap sideways: then
                // they are two lines printed almost on top of each other
                const besideLine = last && (it.x >= last.right - 1 || it.x + it.width <= last.left + 1);
                if (offset <= 1 || (offset <= lineTolerance && besideLine)) {
                    last.items.push(it);
                    last.left = Math.min(last.left, it.x);
                    last.right = Math.max(last.right, it.x + it.width);
                } else {
                    lines.push({ y: it.y, items: [it], left: it.x, right: it.x + it.width });
                }
            });
            lines.forEach(line => {
                line.items.sort((a, b) => a.x - b.x);
                line.x = line.items[0].x;
                line.right = Math.max(...line.items.map(it => it.x + it.width));
                // Put a space between two pieces only where there is a visible gap
                let text = '';
                line.items.forEach((it, index) => {
                    if (index > 0) {
                        const prev = line.items[index - 1];
                        const gap = it.x - (prev.x + prev.width);
                        if (gap > 1 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
                    }
                    text += it.str;
                });
                line.text = text.replace(/\s+/g, ' ').trim();
            });
            return lines;
        };

        const pages = allPages.map(page => {
            const leftLines = toLines(page.items.filter(it => it.x < splitX));

            // Left-hand lines that are not labels are centred headings ("Bid Details/...") or
            // full-width text. Whatever sits on exactly the same line in the value column
            // belongs to them, not to the table.
            const labelLines = [];
            const otherY = [];
            leftLines.forEach(line => {
                const isLabel = Math.abs(line.x - labelX) <= 3 && line.right <= splitX + 5;
                if (isLabel) labelLines.push(line); else otherY.push(line.y);
            });
            const rightLines = toLines(page.items.filter(it =>
                it.x >= splitX && !otherY.some(y => Math.abs(y - it.y) <= 1.2)));
            const valueLines = rightLines.filter(line => line.x >= valueX - 2 && line.x <= valueX + 14);

            // Lines of the same label -> one label block
            const labelBlocks = [];
            labelLines.forEach(line => {
                const last = labelBlocks[labelBlocks.length - 1];
                if (last && last.bottom - line.y <= labelBlockGap) {
                    last.bottom = line.y;
                    last.text += ' ' + line.text;
                } else {
                    labelBlocks.push({ page: page.pageNum, top: line.y, bottom: line.y, text: line.text });
                }
            });
            valueLines.forEach(line => { line.page = page.pageNum; });

            return { pageNum: page.pageNum, labelBlocks, valueLines };
        });

        // --- 2. One continuous vertical scale across pages, so "the middle of the row" still
        //        means something for a row that spans pages
        let contentTop = -Infinity, contentBottom = Infinity;
        pages.forEach(page => {
            page.valueLines.forEach(line => {
                contentTop = Math.max(contentTop, line.y);
                contentBottom = Math.min(contentBottom, line.y);
            });
            page.labelBlocks.forEach(block => {
                contentTop = Math.max(contentTop, block.top);
                contentBottom = Math.min(contentBottom, block.bottom);
            });
        });
        const pageHeight = contentTop - contentBottom + linePitch;
        const globalY = (pageNum, y) => (pageNum - 1) * pageHeight + (contentTop - y);

        // --- 3. Only the pages that hold the table are needed: up to the last of the wanted
        //        rows, and on until two more labels have been seen, so that the row after it
        //        is there in full to mark where it ends
        // (a label is taken where it first appears: the same words can turn up again in
        // other tables much later in the document)
        let lastTargetIndex = -1;
        wantedLabels.concat([targetLabelEnd]).forEach(label => {
            const firstIndex = pages.findIndex(page => page.labelBlocks.some(block => label.test(block.text)));
            lastTargetIndex = Math.max(lastTargetIndex, firstIndex);
        });
        if (lastTargetIndex === -1) return [];
        let labelsAfter = 0;
        let seenLastTarget = false;
        pages[lastTargetIndex].labelBlocks.forEach(block => {
            if (targetLabel.test(block.text) || targetLabelEnd.test(block.text)) { seenLastTarget = true; labelsAfter = 0; }
            else if (seenLastTarget) labelsAfter++;
        });
        let lastIndex = lastTargetIndex;
        while (labelsAfter < 2 && lastIndex + 1 < pages.length && lastIndex < lastTargetIndex + 40) {
            lastIndex++;
            labelsAfter += pages[lastIndex].labelBlocks.length;
        }
        const tablePages = pages.slice(0, lastIndex + 1);

        const lines = tablePages.reduce((all, page) => all.concat(page.valueLines), []);
        lines.forEach(line => { line.g = globalY(line.page, line.y); });
        let blocks = tablePages.reduce((all, page) => all.concat(page.labelBlocks), []).map(block => ({
            text: block.text,
            firstPage: block.page,
            lastPage: block.page,
            gTop: globalY(block.page, block.top),
            gBottom: globalY(block.page, block.bottom)
        }));
        if (lines.length === 0) return blocks.map(block => ({ label: block.text, value: '' }));

        // Safety check: every label must be its own block. If one block holds two of the
        // wanted labels, this PDF is not laid out like a GeM bid and the table cannot be trusted.
        if (blocks.some(block => wantedLabels.filter(label => label.test(block.text)).length > 1)) {
            console.warn('Bid-details table layout not recognised - falling back to text search');
            return [];
        }

        // A label that a page break cuts in two arrives as two pieces
        const mergeBlocks = (list, index) => {
            const first = list[index], second = list[index + 1];
            const merged = {
                text: first.text + ' ' + second.text,
                firstPage: first.firstPage,
                lastPage: second.lastPage,
                gTop: first.gTop,
                gBottom: second.gBottom
            };
            return list.slice(0, index).concat([merged], list.slice(index + 2));
        };
        // ...for the two-line labels among the wanted rows the pieces are recognisable by their wording
        for (let index = 0; index + 1 < blocks.length; index++) {
            if (/\/\s*(Searched|Relevant)\s*$/i.test(blocks[index].text) && targetLabelEnd.test(blocks[index + 1].text) &&
                !targetLabel.test(blocks[index + 1].text)) {
                blocks = mergeBlocks(blocks, index);
            }
        }

        // --- 4. How plausible it is that one row ends and the next begins between line
        //        index-1 and line index (0 = very plausible). Rows are separated by a gap wider
        //        than any gap inside a cell; a long cell can also spill a line into the row below.
        const cellRight = Math.max(...lines.map(line => line.right));
        const breakPenalty = (index) => {
            if (index <= 0 || index >= lines.length) return 0;
            const above = lines[index - 1], below = lines[index];
            // If the first word of the lower line would not have fitted on the upper line,
            // the text simply wrapped: the same cell carries on
            const wrapped = !this.wouldFitOnLine(above, below, cellRight);
            if (above.page !== below.page) return wrapped ? 3 : 0;   // page break
            const gap = above.y - below.y;
            const height = below.items[0].height || 9;
            if (gap >= 2.3 * height) return 0;                       // row gap
            if (gap < 0.9 * height) return 0;                        // overlapping lines
            if (gap >= 1.6 * height) return 3;                       // looks like a paragraph gap inside a cell
            return wrapped ? 10 : 5;                                 // ordinary line spacing
        };

        // --- 5. Split the value lines between the rows.
        //        Both cells of a row are vertically centred, so the value lines of a row must
        //        be centred on its label. First every label is anchored to the value line
        //        beside its middle (nothing is close enough if the value is blank). Then the
        //        split that fits "centred on its label" best for all rows together, and
        //        prefers visible breaks, is found row by row, keeping the best total for
        //        every possible end of each row.
        const solve = (blockList, treatAsBlank = []) => {
            let previousAnchor = -1;
            let lastTargetBlock = -1;
            blockList.forEach((block, index) => { if (targetLabel.test(block.text)) lastTargetBlock = index; });
            const anchoredRows = [];
            const rows = blockList.map((block, blockIndex) => {
                const centre = (block.gTop + block.gBottom) / 2;
                let best = -1, bestDistance = Infinity;
                lines.forEach((line, index) => {
                    const distance = Math.abs(line.g - centre);
                    if (distance < bestDistance) { best = index; bestDistance = distance; }
                });
                const row = { label: block.text, block, blockIndex, centre, anchor: -1, anchorDistance: bestDistance, start: -1, end: -1 };
                // The very last label in range, beyond the wanted rows, is only there to mark
                // where the row before it ends: it must not pick up a doubtful line
                const isRangeEnd = blockIndex === blockList.length - 1 && blockIndex > lastTargetBlock;
                const reach = isRangeEnd ? sureAnchorReach : anchorReach;
                if (best > previousAnchor && bestDistance <= reach && !treatAsBlank.includes(block)) {
                    row.anchor = best;
                    previousAnchor = best;
                    anchoredRows.push(row);
                }
                return row;
            });
            if (anchoredRows.length === 0) return { rows, cost: 0 };

            const rowCost = (row, startIndex, endIndex) => {
                // The row of the last label in range may be cut off where the range ends, so
                // it cannot be checked against its label
                if (row.blockIndex === blockList.length - 1 && row.blockIndex > lastTargetBlock) return 0;
                const first = lines[startIndex], last = lines[endIndex - 1];
                const pageBreaks = last.page - first.page;
                const offCentre = Math.abs((first.g + last.g) / 2 - row.centre - driftPerPageBreak * pageBreaks);
                // A row on one page is centred almost exactly (within about a point in real
                // GeM PDFs), so being off-centre counts double there
                if (pageBreaks === 0) return 2 * offCentre;
                // A row over several pages drifts: within the allowance it counts as centred,
                // and the small remaining weight only settles ties
                const allowance = driftTolerancePerBreak * pageBreaks;
                return offCentre <= allowance ? 0.15 * offCentre : 0.15 * allowance + (offCentre - allowance);
            };

            let previousEnds = new Map();
            for (let index = 0; index <= anchoredRows[0].anchor; index++) previousEnds.set(index, 0);
            const choices = [];
            anchoredRows.forEach((row, rowIndex) => {
                const limit = rowIndex + 1 < anchoredRows.length ? anchoredRows[rowIndex + 1].anchor : lines.length;
                const ends = new Map();
                const choice = new Map();
                for (let endIndex = row.anchor + 1; endIndex <= limit; endIndex++) {
                    let bestCost = Infinity, bestStart = -1;
                    previousEnds.forEach((costSoFar, startIndex) => {
                        if (startIndex > row.anchor) return;
                        const cost = costSoFar + rowCost(row, startIndex, endIndex);
                        if (cost < bestCost) { bestCost = cost; bestStart = startIndex; }
                    });
                    ends.set(endIndex, bestCost + breakPenalty(endIndex));
                    choice.set(endIndex, bestStart);
                }
                choices.push(choice);
                previousEnds = ends;
            });

            // Walk back from the best end of the last row
            let endIndex = -1, total = Infinity;
            previousEnds.forEach((cost, index) => {
                if (cost < total) { total = cost; endIndex = index; }
            });
            for (let rowIndex = anchoredRows.length - 1; rowIndex >= 0; rowIndex--) {
                const startIndex = choices[rowIndex].get(endIndex);
                anchoredRows[rowIndex].start = startIndex;
                anchoredRows[rowIndex].end = endIndex;
                endIndex = startIndex;
            }
            return { rows, cost: total };
        };

        // Any other label cut in two by a page break shows up as two labels that fit badly.
        // Where joining the last label of a page to the first label of the next page makes
        // the whole table fit clearly better, they are one label.
        let solution = solve(blocks);
        for (let index = 0; index + 1 < blocks.length; index++) {
            const first = blocks[index], second = blocks[index + 1];
            if (second.firstPage !== first.lastPage + 1 || second.gTop - first.gBottom > 45) continue;
            if (targetLabel.test(first.text) && targetLabel.test(second.text)) continue;
            const mergedBlocks = mergeBlocks(blocks, index);
            const mergedSolution = solve(mergedBlocks);
            if (mergedSolution.cost < solution.cost - mergeGain) {
                blocks = mergedBlocks;
                solution = mergedSolution;
            }
        }

        // A blank cell normally has no value line anywhere near its label. A line that has
        // spilled out of a long cell above can end up near it, though. Where the nearest
        // line is not right beside the label and the table fits clearly better with the row
        // left blank, the row is blank.
        const blankBlocks = [];
        solution.rows.filter(row => row.anchor !== -1 && row.anchorDistance > sureAnchorReach).forEach(row => {
            const trial = solve(blocks, blankBlocks.concat([row.block]));
            if (trial.cost + blankGain < solution.cost) {
                blankBlocks.push(row.block);
                solution = trial;
            }
        });

        return solution.rows.map(row => ({
            label: row.label,
            value: row.anchor === -1 ? '' : this.joinBidDetailLines(lines.slice(row.start, row.end), valueX, cellRight)
        }));
    }

    // True if the first word of nextLine would still have fitted at the end of line, which
    // means the text did not wrap between them: nextLine starts something new
    wouldFitOnLine(line, nextLine, cellRight) {
        const firstItem = nextLine.items[0];
        const firstWord = firstItem.str.trim().split(/\s+/)[0];
        const firstWordWidth = firstItem.width * (firstWord.length / Math.max(firstItem.str.length, 1));
        const spaceWidth = (firstItem.height || 9) * 0.32;
        return line.right + spaceWidth + firstWordWidth <= cellRight - 1;
    }

    // Joins the lines of one value cell into text. Separate entries of the cell (paragraphs,
    // bullet points) are separated with " | ", the same separator Item Category uses.
    joinBidDetailLines(lines, valueX, cellRight) {
        if (lines.length === 0) return '';
        const paragraphGap = 16;

        let text = '';
        lines.forEach((line, index) => {
            if (index === 0) { text = line.text; return; }
            const previous = lines[index - 1];

            let newEntry = false;
            if (line.x > valueX + 4) {
                newEntry = true;                                   // indented: a bullet point
            } else if (/^Searched\s+String\s*:/i.test(line.text)) {
                newEntry = true;                                   // next searched string in the result list
            } else if (line.page === previous.page) {
                newEntry = previous.y - line.y >= paragraphGap;    // blank space above: new paragraph
            } else {
                // Across a page break the spacing is lost: a new paragraph starts here only
                // if the text did not simply wrap onto the next page
                newEntry = this.wouldFitOnLine(previous, line, cellRight);
            }

            if (newEntry) {
                text += ' | ' + line.text;
            } else if (/\S-$/.test(text) && /^[A-Za-z0-9]/.test(line.text)) {
                text += line.text;                                 // word broken after a hyphen
            } else {
                text += ' ' + line.text;
            }
        });

        return text.replace(/\s+/g, ' ').trim();
    }

    // Extract technical specification URL from PDF text
    extractTechnicalSpec(text) {
        console.log('\n=== EXTRACTING TECHNICAL SPECIFICATION ===');
        
        // If we have no extracted links, return early
        if (!this.pdfLinks || this.pdfLinks.length === 0) {
            console.log('❌ No links found in PDF');
            return 'No technical specification URLs found';
        }
        
        // Show all found links and their types
        console.log(`📋 Found ${this.pdfLinks.length} links:`);
        this.pdfLinks.forEach((link, index) => {
            console.log(`  ${index + 1}. ${link.type}: ${link.url}`);
        });
        
        // Priority order for link types
        const linkPriority = [
            'BOQ Detail Document',
            'Buyer Specification Document',
            'GeM Category Specification'
        ];
        
        // Look for links in priority order
        for (const priority of linkPriority) {
            const link = this.pdfLinks.find(l => l.type === priority);
            if (link) {
                console.log(`✅ Selected: ${priority}`);
                return link.url;
            }
        }
        
        console.log('❌ No technical specification URLs found');
        return 'No technical specification URLs found';
    }



    // UPDATED: categorizeBids - Use actual BID End Date for bid categorization
    categorizeBids(data) {
        const active = [];
        const expired = [];
        const currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
        
        data.forEach(bid => {
            try {
                // Use actual BID End Date for categorization
                const endDateStr = bid['BID End Date'];
                if (!endDateStr || endDateStr === 'Not Found') {
                    // If no valid end date, consider as expired
                    expired.push(bid);
                    return;
                }
                
                // Parse the end date (assuming DD-MM-YYYY format)
                const endDateParts = endDateStr.split('-');
                if (endDateParts.length !== 3) {
                    // Invalid date format, consider as expired
                    expired.push(bid);
                    return;
                }
                
                const endDate = new Date(
                    parseInt(endDateParts[2]), // Year
                    parseInt(endDateParts[1]) - 1, // Month (0-indexed)
                    parseInt(endDateParts[0]) // Day
                );
                
                // Check if end date is valid
                if (isNaN(endDate.getTime())) {
                    expired.push(bid);
                    return;
                }
                
                // Categorize based on end date
                // If end date is today or in the future, consider as active
                // If end date is in the past, consider as expired
                if (endDate >= currentDate) {
                    active.push(bid);
                } else {
                    expired.push(bid);
                }
                
            } catch (error) {
                console.warn('Error categorizing bid:', error);
                // If there's an error, consider as expired
                expired.push(bid);
            }
        });
        
        console.log(`Bids categorized using actual BID End Date: ${active.length} active, ${expired.length} expired`);
        return { active, expired };
    }

    createExcelFile() {
        try {
            console.log('Creating Excel file with', this.extractedData.length, 'records');
            
            // Categorize bids into active and expired
            const categorizedBids = this.categorizeBids(this.extractedData);
            
            // Create workbook
        const wb = XLSX.utils.book_new();
            
            // Create main data array with headers
            const headers = [
                'BID Number', 'Ministry', 'Department', 'BID Start Date', 'BID End Date', 'Organization Name', 'Total Quantity', 
                'Item Category', 'Searched Strings used in GeMARPTS', 'Searched Result generated in GeMARPTS',
                'Relevant Categories selected for notification', 'BOQ Title', 'Technical Specification', 'Filename'
            ];
            
            const data = [headers];
            
            // Add data rows with hyperlink formulas
        this.extractedData.forEach(row => {
                const techSpec = row['Technical Specification'];
                // Check if it's a URL and create a proper Excel HYPERLINK formula
                // Create direct hyperlink without formula
                // Just insert the URL directly - Excel will recognize it as a link
                const techSpecCell = techSpec.startsWith('http') ? techSpec : techSpec || 'Not Found';
                
                data.push([
                    row['BID Number'] || 'Not Found',
                    row['Ministry'] || 'Not Found',
                    row['Buyer'] || 'Not Found',
                    row['BID Start Date'] || 'Not Found',
                    row['BID End Date'] || 'Not Found',
                    row['Organization Name'] || '-',
                    row['Total Quantity'] || 'Not Found',
                    row['Item Category'] || 'Not Found',
                    row['Searched Strings used in GeMARPTS'] || 'Not Found',
                    row['Searched Result generated in GeMARPTS'] || 'Not Found',
                    row['Relevant Categories selected for notification'] || 'Not Found',
                    row['BOQ Title'] || 'Not Found',
                    techSpecCell, // Use the cell object with formula
                    row['Filename'] || 'Not Found'
                ]);
            });
            
            // Create 'All Bids' worksheet
            const wsAll = XLSX.utils.aoa_to_sheet(data);
            this.formatWorksheet(wsAll, 'All Bids');
            XLSX.utils.book_append_sheet(wb, wsAll, 'All Bids');
            
            // Create 'Active Bids' worksheet with Days Pending column
            if (categorizedBids.active.length > 0) {
                const activeHeaders = [...headers];
                activeHeaders.splice(5, 0, 'Days Pending'); // Insert Days Pending after BID End Date
                
                const activeData = [activeHeaders];
                categorizedBids.active.forEach(row => {
                    const techSpec = row['Technical Specification'];
                    // Just use the direct URL
                    const techSpecCell = techSpec.startsWith('http') ? techSpec : techSpec || 'Not Found';
                    
                    // Calculate days pending for active bids
                    const daysPending = this.calculateDaysPending(row['BID End Date']);
                    
                    activeData.push([
                    row['BID Number'] || 'Not Found',
                    row['Ministry'] || 'Not Found',
                    row['Buyer'] || 'Not Found',
                    row['BID Start Date'] || 'Not Found',
                    row['BID End Date'] || 'Not Found',
                    daysPending, // Days Pending column
                    row['Organization Name'] || '-',
                    row['Total Quantity'] || 'Not Found',
                    row['Item Category'] || 'Not Found',
                    row['Searched Strings used in GeMARPTS'] || 'Not Found',
                    row['Searched Result generated in GeMARPTS'] || 'Not Found',
                    row['Relevant Categories selected for notification'] || 'Not Found',
                    row['BOQ Title'] || 'Not Found',
                        techSpecCell,
                        row['Filename'] || 'Not Found'
                    ]);
                });
                const wsActive = XLSX.utils.aoa_to_sheet(activeData);
                this.formatWorksheet(wsActive, 'Active Bids');
                XLSX.utils.book_append_sheet(wb, wsActive, 'Active Bids');
            }
            
            // Create 'Expired Bids' worksheet
            if (categorizedBids.expired.length > 0) {
                const expiredData = [headers];
                categorizedBids.expired.forEach(row => {
                    const techSpec = row['Technical Specification'];
                    // For hyperlinks, just use the raw Excel formula string
                    // Just use the direct URL
                    const techSpecCell = techSpec.startsWith('http') ? techSpec : techSpec || 'Not Found';
                    
                    expiredData.push([
                    row['BID Number'] || 'Not Found',
                    row['Ministry'] || 'Not Found',
                    row['Buyer'] || 'Not Found',
                    row['BID Start Date'] || 'Not Found',
                    row['BID End Date'] || 'Not Found',
                    row['Organization Name'] || '-',
                    row['Total Quantity'] || 'Not Found',
                    row['Item Category'] || 'Not Found',
                    row['Searched Strings used in GeMARPTS'] || 'Not Found',
                    row['Searched Result generated in GeMARPTS'] || 'Not Found',
                    row['Relevant Categories selected for notification'] || 'Not Found',
                    row['BOQ Title'] || 'Not Found',
                        techSpecCell,
                        row['Filename'] || 'Not Found'
                    ]);
                });
                const wsExpired = XLSX.utils.aoa_to_sheet(expiredData);
                this.formatWorksheet(wsExpired, 'Expired Bids');
                XLSX.utils.book_append_sheet(wb, wsExpired, 'Expired Bids');
            }
            
            // Create summary worksheet
            const summaryData = [
                ['Summary Statistics'],
                [''],
                ['Total Bids', this.extractedData.length],
                ['Active Bids', categorizedBids.active.length],
                ['Expired Bids', categorizedBids.expired.length],
                [''],
                ['Generated on', new Date().toLocaleString()],
                ['Total Files Processed', this.uploadedFiles.length]
            ];
            
            const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
            this.formatWorksheet(wsSummary, 'Summary');
            XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

        // Generate Excel file
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Create download link
        const url = URL.createObjectURL(blob);
        const downloadBtn = document.getElementById('downloadBtn');
        downloadBtn.href = url;
            downloadBtn.download = `GeM_Bidding_Data_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            console.log('Excel file created successfully with', wb.SheetNames.length, 'worksheets');
            return true;
            
        } catch (error) {
            console.error('Error creating Excel file:', error);
            this.showStatus('Error creating Excel file: ' + error.message, 'error');
            return false;
        }
    }

    // Format worksheet with consistent styling and proper hyperlinks
    formatWorksheet(ws, title) {
        // Auto-size columns
        const colWidths = [];
        const maxColWidth = 100;
        
        // Get all data rows
        const dataRows = [];
        for (const cell in ws) {
            if (cell[0] === '!') continue; // Skip special properties
            const row = parseInt(cell.replace(/[A-Z]/g, ''));
            if (!dataRows.includes(row)) dataRows.push(row);
        }
        
        // Process each cell for formatting
        dataRows.forEach(row => {
            Object.keys(ws).forEach(cell => {
                if (cell[0] === '!') return;
                
                const cellData = ws[cell];
                const col = cell.replace(/\d/g, '');
                const colIndex = XLSX.utils.decode_col(col);
                
                // Calculate column width - skip formatting for URLs
                if (!(typeof cellData.v === 'string' && cellData.v.startsWith('http'))) {
                    const cellValue = cellData.v || '';
                    const valueLength = String(cellValue).length;
                colWidths[colIndex] = Math.max(colWidths[colIndex] || 0, 
                    Math.min(valueLength, maxColWidth));
                }
            });
        });

        // Set column widths
        ws['!cols'] = colWidths.map(width => ({ 
            width: Math.min(width + 3, maxColWidth + 5),
            wrapText: true
        }));

        // Set row heights
        ws['!rows'] = [];
        const maxRow = Math.max(...dataRows);
        for (let i = 0; i <= maxRow; i++) {
            ws['!rows'][i] = { hpt: 25 };
        }

        // Style header row
        const headerRow = 1;
        Object.keys(ws).forEach(cell => {
            if (cell[0] === '!') return;
            const row = parseInt(cell.replace(/[A-Z]/g, ''));
            if (row === headerRow) {
                ws[cell].s = {
                    font: { bold: true },
                    alignment: { horizontal: 'center', vertical: 'center' },
                    fill: { fgColor: { rgb: "E6E6FA" } }
                };
            }
        });
    }

    showProgress() {
        document.getElementById('progressSection').style.display = 'block';
        document.getElementById('downloadSection').style.display = 'none';
    }

    hideProgress() {
        document.getElementById('progressSection').style.display = 'none';
    }

    updateProgress(percentage, text) {
        document.getElementById('progressFill').style.width = percentage + '%';
        document.getElementById('progressText').textContent = text;
    }

    showDownloadSection() {
        document.getElementById('downloadSection').style.display = 'block';
    }

    // IMPROVED: Show summary of extracted data with bid categorization
    showExtractionSummary() {
        const summaryDiv = document.getElementById('extractionSummary');
        if (!summaryDiv || this.extractedData.length === 0) return;

        // Categorize bids for summary
        const { activeBids, expiredBids } = this.categorizeBids(this.extractedData);

        let summaryHTML = '<h4>Extraction Summary</h4>';
        
        // Overall statistics
        summaryHTML += `
            <div class="summary-item">
                <span class="summary-label">Total Bids Processed:</span>
                <span class="summary-value">${this.extractedData.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Active Bids:</span>
                <span class="summary-value" style="color: #28a745;">${activeBids.length}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Expired Bids:</span>
                <span class="summary-value" style="color: #dc3545;">${expiredBids.length}</span>
            </div>
            <hr style="margin: 15px 0; border: none; border-top: 1px solid #e9ecef;">
        `;
        
        // File details
        this.extractedData.forEach((data, index) => {
            const filename = this.uploadedFiles[index]?.name || `File ${index + 1}`;
            const isActive = activeBids.some(bid => 
                bid['BID Number'] === data['BID Number'] || 
                bid['BID Start Date'] === data['BID Start Date']
            );
            const statusColor = isActive ? '#28a745' : '#dc3545';
            const statusText = isActive ? 'Active' : 'Expired';
            
            summaryHTML += `
                <div class="summary-item">
                    <span class="summary-label">File:</span>
                    <span class="summary-value">${filename}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Status:</span>
                    <span class="summary-value" style="color: ${statusColor}; font-weight: 600;">${statusText}</span>
                </div>
            `;
            
            // Show key extracted fields
            const keyFields = ['BID Number', 'Ministry', 'Department', 'BID End Date', 'Organization Name', 'Total Quantity'];
            keyFields.forEach(field => {
                if (data[field] && data[field] !== 'Not Found') {
                    const value = data[field].length > 30 ? data[field].substring(0, 30) + '...' : data[field];
                    summaryHTML += `<div class="summary-item"><span class="summary-label">${field}:</span><span class="summary-value">${value}</span></div>`;
                }
            });
            
            // Show if Item Category was found
            if (data['Item Category'] && data['Item Category'] !== 'Not Found') {
                const itemCount = data['Item Category'].split('\n').length;
                summaryHTML += `<div class="summary-item"><span class="summary-label">Categories Found:</span><span class="summary-value">${itemCount} groups</span></div>`;
            }
            
            if (index < this.extractedData.length - 1) {
                summaryHTML += '<hr style="margin: 15px 0; border: none; border-top: 1px solid #e9ecef;">';
            }
        });

        summaryDiv.innerHTML = summaryHTML;
    }

    showStatus(message, type) {
        const statusDiv = document.getElementById('statusMessage');
        statusDiv.className = `status-message status-${type}`;
        statusDiv.textContent = message;
        statusDiv.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 5000);
    }

    // NEW FUNCTION: Validate extracted data quality
    validateExtractedData(data) {
        const warnings = [];
        let isValid = true;

        // Check for default/fallback values
        if (data['BID Number'] === 'GEM/2025/B/XXXXXXX') {
            warnings.push('BID Number may be using default value');
        }
        if (data['Ministry'] === 'Ministry of Defence') {
            warnings.push('Ministry information may be using default value');
        }
        if (data['Department'] === 'Department of Military Affairs') {
            warnings.push('Department information may be using default value');
        }
        if (data['BID Start Date'] === '01-03-2025') {
            warnings.push('BID Start Date may be using default value');
        }
        if (data['BID End Date'] === 'Not Found') {
            warnings.push('BID End Date not found in document');
            isValid = false;
        }
        if (data['Organization Name'] === '-') {
            warnings.push('Organization Name not found in document');
            isValid = false;
        }
        if (data['Total Quantity'] === 'Not Found') {
            warnings.push('Total Quantity not found in document');
            isValid = false;
        }
        if (data['Item Category'] === 'Not Found') {
            warnings.push('Item Category not found in document');
            isValid = false;
        }

        // Check for reasonable data lengths
        if (data['Item Category'] && data['Item Category'].length < 50) {
            warnings.push('Item Category content seems too short - extraction may be incomplete');
        }

        return { isValid, warnings };
    }
}

// Initialize the GeM Bidding Data Extractor application
try {
    console.log('Initializing GeM Bidding Data Extractor...');
const app = new GeMBiddingDataExtractor();
    console.log('App created successfully:', app);

// Export the app for global access
window.app = app;
    console.log('App exported to window.app:', window.app);
    
    // Verify the app is accessible
    if (window.app && typeof window.app.extractDataFromPDF === 'function') {
        console.log('✅ App is properly initialized and accessible');
    } else {
        console.error('❌ App initialization failed - methods not available');
    }
    
} catch (error) {
    console.error('❌ Error initializing app:', error);
    console.error('Stack trace:', error.stack);
}

// Add debug functionality
if (window.app) {
    window.app.toggleDebug = function() {
        const debugSection = document.getElementById('debugSection');
        const debugContent = document.getElementById('debugContent');
        
        if (debugSection && debugContent) {
            if (debugSection.style.display === 'none' || !debugSection.style.display) {
                debugSection.style.display = 'block';
                debugContent.textContent = JSON.stringify({
                    uploadedFiles: this.uploadedFiles.map(f => ({ name: f.name, size: f.size })),
                    extractedData: this.extractedData,
                    timestamp: new Date().toISOString()
                }, null, 2);
            } else {
                debugSection.style.display = 'none';
            }
        } else {
            console.warn('Debug elements not found');
        }
    };

    // NEW FUNCTION: Show console debug information
    window.app.showConsoleDebug = function() {
        if (this.extractedData.length > 0) {
            console.log('=== EXTRACTED DATA DEBUG ===');
            console.log('Full extracted data:', this.extractedData);
            
            this.extractedData.forEach((data, index) => {
                console.log(`\n--- File ${index + 1}: ${this.uploadedFiles[index]?.name} ---`);
                Object.entries(data).forEach(([key, value]) => {
                    console.log(`${key}:`, value);
                });
            });
            
            console.log('=== END EXTRACTED DATA DEBUG ===');
        } else {
            console.log('No extracted data available. Please process a PDF first.');
        }
        
        this.showStatus('Debug info logged to console. Press F12 to view.', 'success');
    };

    // NEW FUNCTION: Test technical specification categorization
    window.app.testTechSpecCategorization = function() {
        console.log('=== TESTING TECHNICAL SPECIFICATION CATEGORIZATION ===');
        
        // Test cases for different formats
        const testCases = [
            {
                name: 'Format 1: BOQ Detail Document',
                url: 'https://example.com/boq_document.pdf',
                context: 'BOQ Detail Document View File',
                expected: 'BOQ Detail Document'
            },
            {
                name: 'Format 2: Buyer Specification Document',
                url: 'https://example.com/buyer_spec.pdf',
                context: 'Buyer Specification Document Download',
                expected: 'Buyer Specification Document'
            },
            {
                name: 'Format 3: GeM Category Specification (embedded)',
                url: 'https://example.com/gem_spec.pdf',
                context: '* जेम केटेगरी विशिष्टि के अनुसार / As per GeM Category Specification',
                expected: 'GeM Category Specification'
            },
            {
                name: 'Format 3: GeM Category Specification (with asterisk)',
                url: 'https://example.com/gem_spec2.pdf',
                context: '*As per GeM Category Specification',
                expected: 'GeM Category Specification'
            },
            {
                name: 'Format 3: GeM Category Specification (Hindi)',
                url: 'https://example.com/gem_spec3.pdf',
                context: 'जेम केटेगरी विशिष्टि के अनुसार',
                expected: 'GeM Category Specification'
            },
            {
                name: 'Format 3: GeM Category Specification (gem.gov.in fallback)',
                url: 'https://mkp.gem.gov.in/uploaded_documents/51/16/877/OrderItem/BoqDocument/2025/2/6/22mac0095_tech_spec_2025-02-06-15-49-20_5b7fe797136abb9a018fc0236beb61f6.pdf',
                context: 'Technical Specifications As per GeM Category Specification',
                expected: 'GeM Category Specification'
            }
        ];
        
        testCases.forEach(testCase => {
            console.log(`\n--- Testing: ${testCase.name} ---`);
            console.log('URL:', testCase.url);
            console.log('Context:', testCase.context);
            console.log('Expected:', testCase.expected);
            
            // Simulate the categorization logic
            const lowerContext = testCase.context.toLowerCase();
            const lowerUrl = testCase.url.toLowerCase();
            const pageText = testCase.context; // Simplified for testing
            
            let result = 'Other';
            
            // BOQ check
            if (lowerContext.includes('boq detail document') || 
                lowerContext.includes('boq document') ||
                (lowerContext.includes('boq') && lowerContext.includes('view file')) ||
                lowerUrl.includes('boqdocument') ||
                lowerUrl.includes('boq_detail_document')) {
                result = 'BOQ Detail Document';
            }
            // Buyer Spec check
            else if (lowerContext.includes('buyer specification document') || 
                lowerContext.includes('buyer spec') ||
                (lowerContext.includes('specification') && lowerContext.includes('download')) ||
                lowerUrl.includes('buyer_specification') ||
                lowerUrl.includes('buyerspecification') ||
                lowerUrl.includes('spec_document')) {
                result = 'Buyer Specification Document';
            }
            // GeM Category check - context first
            else {
                const gemSpecContextPatterns = [
                    'as per gem category specification',
                    'जेम केटेगरी विशिष्टि के अनुसार',
                    '*as per gem category specification',
                    '* जेम केटेगरी विशिष्टि के अनुसार',
                    'gem category specification',
                    'जेम केटेगरी विशिष्टि'
                ];
                
                for (const pattern of gemSpecContextPatterns) {
                    if (lowerContext.includes(pattern)) {
                        if (!lowerUrl.includes('boq') && 
                            !lowerUrl.includes('buyer') && 
                            !lowerUrl.includes('specification_document')) {
                            result = 'GeM Category Specification';
                            break;
                        }
                    }
                }
                
                // If no context match, check for Technical Specifications section
                if (result === 'Other' && pageText.includes('Technical Specifications')) {
                    const gemSpecPatterns = [
                        'As per GeM Category Specification',
                        'जेम केटेगरी विशिष्टि के अनुसार',
                        '*As per GeM Category Specification',
                        '* जेम केटेगरी विशिष्टि के अनुसार',
                        'GeM Category Specification',
                        'जेम केटेगरी विशिष्टि'
                    ];
                    
                    for (const pattern of gemSpecPatterns) {
                        if (pageText.includes(pattern)) {
                            if (!lowerUrl.includes('boq') && 
                                !lowerUrl.includes('buyer') && 
                                !lowerUrl.includes('specification_document')) {
                                result = 'GeM Category Specification';
                                break;
                            }
                        }
                    }
                    
                    // Fallback for gem.gov.in URLs in Technical Specifications
                    if (result === 'Other' && 
                        lowerUrl.includes('gem.gov.in') && 
                        (lowerUrl.includes('spec') || lowerUrl.includes('document') || lowerUrl.includes('pdf')) &&
                        !lowerUrl.includes('boq') && 
                        !lowerUrl.includes('buyer')) {
                        result = 'GeM Category Specification';
                    }
                }
            }
            
            const passed = result === testCase.expected;
            console.log(`Result: ${result} ${passed ? '✅ PASS' : '❌ FAIL'}`);
        });
        
        console.log('\n=== END CATEGORIZATION TEST ===');
        this.showStatus('Categorization test completed. Check console for results.', 'success');
    };
} else {
    console.error('❌ Cannot add debug functions - app not available');
}
