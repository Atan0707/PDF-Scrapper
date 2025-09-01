import { useEffect, useState } from 'react'
import { pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import OpenAI from "openai"
import { PDF_EXTRACTION_PROMPT } from "./prompt"

// Set up the worker for react-pdf
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

interface PageText {
  pageNumber: number
  text: string
}

interface ExtractedData {
  title: string
  year: string
  source: string
  livestock_types: string[]
  summary: {
    jumlah: Record<string, number>
    pertubuhan: Record<string, number>
    individu: Record<string, number>
  }
  states: Record<string, Record<string, {
    individu: number
    pertubuhan: number
  }>>
}

function App() {
  const [pageTexts, setPageTexts] = useState<PageText[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startPage, setStartPage] = useState<string>('')
  const [endPage, setEndPage] = useState<string>('')
  const [totalPages, setTotalPages] = useState<number>(0)
  const [extractedData, setExtractedData] = useState<ExtractedData | Record<string, string | number>[] | null>(null)
  const [processingWithAI, setProcessingWithAI] = useState(false)
  const [excelTableData, setExcelTableData] = useState<string>('')
  const [generatingTable, setGeneratingTable] = useState(false)
  const [autoGenerateTable, setAutoGenerateTable] = useState(false)
  
  const API_KEY=import.meta.env.VITE_GROQ_API_KEY;

  // Initialize OpenAI client
  const client = new OpenAI({
    apiKey: API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
    dangerouslyAllowBrowser: true,
  });

  // Load PDF metadata to get total pages
  useEffect(() => {
    console.log("API_KEY: ",API_KEY)
    const loadPdfMetadata = async () => {
      try {
        const response = await fetch('/pdf/ternakan.pdf')
        if (!response.ok) {
          throw new Error('Failed to fetch PDF file')
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const pdf = await pdfjs.getDocument(arrayBuffer).promise
        setTotalPages(pdf.numPages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while loading the PDF')
        console.error('Error loading PDF:', err)
      }
    }
    
    loadPdfMetadata()
  }, [API_KEY])

  const extractPagesText = async () => {
    try {
      setLoading(true)
      setError(null)
      setPageTexts([])
      
      const start = parseInt(startPage) || 1
      const end = endPage ? parseInt(endPage) : start
      
      // Validation
      if (start < 1 || start > totalPages) {
        throw new Error(`Start page must be between 1 and ${totalPages}`)
      }
      if (end < start || end > totalPages) {
        throw new Error(`End page must be between ${start} and ${totalPages}`)
      }
      
      // Fetch the PDF file from the public directory
      const response = await fetch('/pdf/ternakan.pdf')
      if (!response.ok) {
        throw new Error('Failed to fetch PDF file')
      }
      
      const arrayBuffer = await response.arrayBuffer()
      const pdf = await pdfjs.getDocument(arrayBuffer).promise
      
      const extractedPages: PageText[] = []
      
      // Extract text from specified pages
      for (let pageNum = start; pageNum <= end; pageNum++) {
        const page = await pdf.getPage(pageNum)
        const textContent = await page.getTextContent()
        const pageText = textContent.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
        
        extractedPages.push({
          pageNumber: pageNum,
          text: pageText
        })
      }
      
      setPageTexts(extractedPages)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while extracting pages')
      console.error('Error extracting pages:', err)
    } finally {
      setLoading(false)
    }
  }

  const processWithAI = async () => {
    if (pageTexts.length === 0) {
      setError('No extracted text available to process')
      return
    }

    let responseContent = ''
    let cleanedResponse = ''
    
    try {
      setProcessingWithAI(true)
      setError(null)
      
      // Combine all page texts
      const combinedText = pageTexts.map(page => page.text).join('\n\n')
      
      // Call OpenAI API
      const completion = await client.chat.completions.create({
        model: "openai/gpt-oss-20b", // You can change your model here
        messages: [
          {
            role: "system",
            content: PDF_EXTRACTION_PROMPT // You can custom the prompt on prompt.ts
          },
          {
            role: "user", 
            content: `Please extract and format the following PDF text data:\n\n${combinedText}`
          }
        ],
        temperature: 0.1, // Low temperature for more consistent output
        max_tokens: 20000 // Increased to handle larger responses
      })

      responseContent = completion.choices[0]?.message?.content || ''
      if (!responseContent) {
        throw new Error('No response from AI')
      }
      
      // Check if the response might be truncated
      const finishReason = completion.choices[0]?.finish_reason
      if (finishReason === 'length') {
        console.warn('⚠️ AI response was truncated due to length limits. Some data may be incomplete.')
      }

      // Clean the response content by removing markdown code blocks and other formatting
      cleanedResponse = responseContent.trim()
      console.log('Original response:', cleanedResponse.substring(0, 200))
      
      // Simple and reliable markdown cleaning
      // Remove **text** patterns
      cleanedResponse = cleanedResponse.replace(/\*\*[^*]+\*\*/g, '')
      
      // Split by lines and remove markdown code block lines
      const lines = cleanedResponse.split('\n')
      const cleanedLines = lines.filter(line => {
        const trimmedLine = line.trim()
        return !trimmedLine.startsWith('```') && trimmedLine !== '```'
      })
      cleanedResponse = cleanedLines.join('\n').trim()
      
      // Remove any remaining common prefixes that AI might add
      cleanedResponse = cleanedResponse
        .replace(/^\s*(json|JSON)\s*/i, '')
        .replace(/^\s*(here\s+(is|are)\s+(the\s+)?)?((json|data|result|output)[\s:]*)+\s*/i, '')
        .trim()
      
      console.log('After markdown cleaning:', cleanedResponse.substring(0, 200))
      
      // More sophisticated JSON extraction
      let jsonContent = cleanedResponse
      
      // First try to find array format [...]
      const arrayStartIndex = cleanedResponse.indexOf('[')
      if (arrayStartIndex !== -1) {
        // Find the matching closing bracket by counting
        let bracketCount = 0
        let endPos = arrayStartIndex
        
        for (let i = arrayStartIndex; i < cleanedResponse.length; i++) {
          if (cleanedResponse[i] === '[') {
            bracketCount++
          } else if (cleanedResponse[i] === ']') {
            bracketCount--
            if (bracketCount === 0) {
              endPos = i
              break
            }
          }
        }
        
        if (bracketCount === 0) {
          jsonContent = cleanedResponse.substring(arrayStartIndex, endPos + 1)
        }
      } else {
        // Look for object format {...}
        const firstBrace = cleanedResponse.indexOf('{')
        if (firstBrace !== -1) {
          // Find the matching closing brace by counting
          let braceCount = 0
          let endPos = firstBrace
          
          for (let i = firstBrace; i < cleanedResponse.length; i++) {
            if (cleanedResponse[i] === '{') {
              braceCount++
            } else if (cleanedResponse[i] === '}') {
              braceCount--
              if (braceCount === 0) {
                endPos = i
                break
              }
            }
          }
          
          if (braceCount === 0) {
            jsonContent = cleanedResponse.substring(firstBrace, endPos + 1)
          }
        }
      }
      
      cleanedResponse = jsonContent.trim()
      
      // Try to parse the JSON response
      let parsedData: ExtractedData | Record<string, string | number>[]
      try {
        parsedData = JSON.parse(cleanedResponse)
      } catch (parseError) {
        console.log('Initial JSON parse failed, trying fallback methods...')
        console.log('Cleaned response:', cleanedResponse)
        
        // Try different extraction methods as fallbacks
        const fallbackMethods = [
          // Method 1: Try to extract array format more aggressively
          () => {
            const arrayMatch = cleanedResponse.match(/\[\s*\{[\s\S]*?\}\s*\]/g)
            if (arrayMatch && arrayMatch.length > 0) {
              // Try each match
              for (const match of arrayMatch) {
                try {
                  return JSON.parse(match)
                } catch {
                  continue
                }
              }
            }
            return null
          },
          
          // Method 2: Try to extract just the first complete object
          () => {
            const objectMatch = cleanedResponse.match(/\{[\s\S]*?\}/)
            if (objectMatch) {
              try {
                return JSON.parse(objectMatch[0])
              } catch {
                return null
              }
            }
            return null
          },
          
          // Method 3: Try to fix common JSON issues
          () => {
            const fixedJson = cleanedResponse
              .replace(/,\s*}/g, '}') // Remove trailing commas
              .replace(/,\s*]/g, ']') // Remove trailing commas in arrays
              .replace(/(['"])?([a-zA-Z0-9_]+)(['"])?:/g, '"$2":') // Fix unquoted keys
            
            try {
              return JSON.parse(fixedJson)
            } catch {
              return null
            }
          },
          
          // Method 4: Try to extract content up to the first valid JSON end
          () => {
            // Find the first { or [ and try to parse incrementally
            const startChar = cleanedResponse.search(/[{[]/)
            if (startChar === -1) return null
            
            for (let i = cleanedResponse.length; i > startChar; i--) {
              const candidate = cleanedResponse.substring(startChar, i).trim()
              if (candidate.endsWith('}') || candidate.endsWith(']')) {
                try {
                  return JSON.parse(candidate)
                } catch {
                  continue
                }
              }
            }
            return null
          },
          
          // Method 5: Handle truncated JSON by attempting to fix it
          () => {
            console.log('Attempting to fix truncated JSON...')
            let fixedJson = cleanedResponse.trim()
            
            // If it looks like it's cut off mid-array, try to close it properly
            if (fixedJson.startsWith('[') && !fixedJson.endsWith(']')) {
              console.log('Detected truncated array, attempting to fix...')
              
              // Remove incomplete trailing content (anything after the last complete object)
              const lastCompleteObject = fixedJson.lastIndexOf('}')
              if (lastCompleteObject > 0) {
                fixedJson = fixedJson.substring(0, lastCompleteObject + 1)
              }
              
              // Count open braces vs closed braces
              let openBraces = 0
              let openBrackets = 0
              
              for (const char of fixedJson) {
                if (char === '{') openBraces++
                else if (char === '}') openBraces--
                else if (char === '[') openBrackets++
                else if (char === ']') openBrackets--
              }
              
              console.log(`Open braces: ${openBraces}, Open brackets: ${openBrackets}`)
              
              // Close any unclosed objects
              while (openBraces > 0) {
                fixedJson += '}'
                openBraces--
              }
              
              // Close the main array
              if (openBrackets > 0) {
                fixedJson += ']'
              }
              
              try {
                console.log('Attempting to parse fixed JSON...')
                const parsed = JSON.parse(fixedJson)
                console.log('✅ Successfully parsed truncated JSON!')
                return parsed
              } catch (e) {
                console.log('Fixed JSON still invalid:', e)
                return null
              }
            }
            
            return null
          }
        ]
        
        // Try each fallback method
        for (const method of fallbackMethods) {
          try {
            const result = method()
            if (result) {
              console.log('Fallback method succeeded!')
              
              // Check if this was the truncation fix method
              if (fallbackMethods.indexOf(method) === 4) { // Method 5 (index 4)
                console.warn('⚠️ Used truncated JSON fix - some data may be incomplete')
                // You could set a flag here to show a warning to the user
              }
              
              setExtractedData(result as ExtractedData | Record<string, string | number>[])
              // Only auto-generate table if enabled (disabled by default to avoid rate limits)
              if (autoGenerateTable) {
                generateTableData(result as ExtractedData | Record<string, string | number>[])
              } else {
                setExcelTableData('Click "🔄 Generate Table" below to create Excel-formatted table')
              }
              return
            }
          } catch (e) {
            console.log('Fallback method failed:', e)
            continue
          }
        }
        
        // If all fallbacks fail, throw the original error with more context
        throw new Error(`JSON parsing failed with all fallback methods. Original error: ${parseError instanceof Error ? parseError.message : 'Unknown parsing error'}. Response content (first 300 chars): ${cleanedResponse.substring(0, 300)}...`)
      }
      
      setExtractedData(parsedData as ExtractedData)
      // Only auto-generate table if enabled (disabled by default to avoid rate limits)
      if (autoGenerateTable) {
        generateTableData(parsedData as ExtractedData)
      } else {
        setExcelTableData('Click "🔄 Generate Table" below to create Excel-formatted table')
      }
      
    } catch (err) {
      console.error('Error processing with AI:', err)
      console.error('Raw response content:', responseContent)
      console.error('Cleaned response:', cleanedResponse)
      
      let errorMessage = 'An error occurred while processing with AI'
      if (err instanceof Error) {
        if (err.message.includes('Unexpected token')) {
          errorMessage = `JSON parsing failed. The AI response may contain invalid formatting. Error: ${err.message}`
        } else {
          errorMessage = err.message
        }
      }
      setError(errorMessage)
    } finally {
      setProcessingWithAI(false)
    }
  }

  const generateTableData = async (data: ExtractedData | Record<string, string | number>[]) => {
    try {
      setGeneratingTable(true)
      const tableData = await generateExcelTable(data)
      setExcelTableData(tableData)
    } catch (error) {
      console.error('Error generating table data:', error)
      setExcelTableData('Error generating table data')
    } finally {
      setGeneratingTable(false)
    }
  }

  const convertToCSV = (data: ExtractedData | Record<string, string | number>[]): string => {
    const lines: string[] = []
    
    // Check if data is array format or traditional format
    if (Array.isArray(data)) {
      // Handle array format (table data)
      if (data.length === 0) return ''
      
      // Get headers from the first object
      const headers = Object.keys(data[0])
      lines.push(headers.join(','))
      
      // Add data rows
      data.forEach(row => {
        const values = headers.map(header => {
          const value = row[header]
          if (value === null || value === undefined || value === '') {
            return ''
          }
          return String(value)
        })
        lines.push(values.join(','))
      })
      
      return lines.join('\n')
    } else {
      // Handle traditional ExtractedData format
      // Header with document info
      lines.push(`${data.title}`)
      lines.push(`Tahun: ${data.year}`)
      lines.push(`Sumber: ${data.source}`)
      lines.push(`Jenis Ternakan: ${data.livestock_types.join(', ')}`)
      lines.push('')
      
      // Summary data
      lines.push('Ringkasan Data')
      lines.push('Category,Type,Total,' + data.livestock_types.join(','))
      
      // JUMLAH row
      const jumlahRow = ['JUMLAH', 'Total', data.summary.jumlah.total]
      data.livestock_types.forEach(type => {
        jumlahRow.push(data.summary.jumlah[type] || 0)
      })
      lines.push(jumlahRow.join(','))
      
      // PERTUBUHAN row
      const pertubRows = ['PERTUBUHAN', 'Total', data.summary.pertubuhan.total]
      data.livestock_types.forEach(type => {
        pertubRows.push(data.summary.pertubuhan[type] || 0)
      })
      lines.push(pertubRows.join(','))
      
      // INDIVIDU row
      const individuRow = ['INDIVIDU', 'Total', data.summary.individu.total]
      data.livestock_types.forEach(type => {
        individuRow.push(data.summary.individu[type] || 0)
      })
      lines.push(individuRow.join(','))
      
      lines.push('')
      
      // State-wise data
      lines.push('Data mengikut negeri')
      
      // Create headers for state data
      const stateHeaders = ['State', 'Livestock_Type', 'Category', 'Count']
      lines.push(stateHeaders.join(','))
      
      // Add state data rows
      Object.entries(data.states).forEach(([stateName, stateData]) => {
        data.livestock_types.forEach(livestockType => {
          if (stateData[livestockType]) {
            lines.push([stateName, livestockType, 'individu', stateData[livestockType].individu].join(','))
            lines.push([stateName, livestockType, 'pertubuhan', stateData[livestockType].pertubuhan].join(','))
          }
        })
      })
      
      return lines.join('\n')
    }
  }

  const downloadCSV = () => {
    if (!extractedData) return
    
    const csvContent = convertToCSV(extractedData)
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    
    // Generate filename based on data type
    const filename = Array.isArray(extractedData) 
      ? 'table-data.csv' 
      : `livestock-data-${extractedData.year || 'export'}.csv`
    link.download = filename
    
    link.click()
    URL.revokeObjectURL(url)
  }

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  const generateExcelTable = async (data: ExtractedData | Record<string, string | number>[], retryCount = 0): Promise<string> => {
    try {
      console.log('Generating Excel table with AI...')
      
      const completion = await client.chat.completions.create({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: `You are a data formatting expert. Convert JSON data into tab-separated table format suitable for Excel/Google Sheets.

Rules:
1. Create clear, descriptive headers by flattening nested objects
2. For nested objects like {"Individual": {"Number": 123, "Sales": 456}}, create headers like "Individual Number" and "Individual Sales"
3. Each row should be tab-separated values
4. Handle missing/null values as "-"
5. Keep numbers as numbers (no quotes)
6. Return ONLY the table data, no explanations or markdown
7. First line should be headers, followed by data rows
8. Make headers human-readable and professional

Example:
Input: [{"State": "Malaysia", "Individual": {"Number": 123, "Sales Quantity": 456}}]
Output:
State	Individual Number	Individual Sales Quantity
Malaysia	123	456`
          },
          {
            role: "user",
            content: `Convert this JSON data to tab-separated table format:\n\n${JSON.stringify(data, null, 2)}`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000 // Reduced to help with rate limits
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from AI for table generation')
      }

      // Clean the response to ensure it's just the table
      let cleanedTable = response.trim()
      
      // Remove any markdown formatting
      cleanedTable = cleanedTable.replace(/```\w*\n?/g, '').replace(/```/g, '').trim()
      
      console.log('✅ Successfully generated Excel table with AI')
      return cleanedTable
      
    } catch (error: unknown) {
      console.error('Error generating Excel table with AI:', error)
      
      // Handle rate limit errors with exponential backoff
      const isRateLimit = error && typeof error === 'object' && 'status' in error && error.status === 429
      
      if (isRateLimit && retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 10000 // 10s, 20s, 40s
        console.log(`⏳ Rate limited. Waiting ${waitTime/1000}s before retry ${retryCount + 1}/3...`)
        
        await sleep(waitTime)
        return generateExcelTable(data, retryCount + 1)
      }
      
      // If rate limited and out of retries, provide helpful message
      if (isRateLimit) {
        return `Rate limit reached. Please wait a few minutes and click "🔄 Regenerate Table" to try again.\n\nOr use the fallback table below:\n\n${generateFallbackTable(data)}`
      }
      
      // For other errors, use fallback
      return generateFallbackTable(data)
    }
  }

  const generateFallbackTable = (data: ExtractedData | Record<string, string | number>[]): string => {
    if (Array.isArray(data)) {
      if (data.length === 0) return 'No data available'
      
      console.log('Using fallback table generation...')
      // Simple fallback - just show the JSON structure
      const headers = Object.keys(data[0])
      const headerRow = headers.join('\t')
      const rows = data.map(row => 
        headers.map(key => {
          const value = row[key]
          if (typeof value === 'object' && value !== null) {
            return JSON.stringify(value)
          }
          return String(value || '-')
        }).join('\t')
      )
      
      return [headerRow, ...rows].join('\n')
    } else {
      return 'Data format not supported for table generation'
    }
  }

  const clearAll = () => {
    setPageTexts([])
    setStartPage('')
    setEndPage('')
    setExtractedData(null)
    setExcelTableData('')
    setError(null)
    setAutoGenerateTable(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">PDF Page Extractor</CardTitle>
            <p className="text-gray-600 text-center">
              Extract text from specific pages of your PDF document
            </p>
          </CardHeader>
          <CardContent>
            {totalPages > 0 && (
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  📄 Total pages in PDF: <span className="font-semibold">{totalPages}</span>
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                {/* Before this aku buat dia as start page */}
                <Label htmlFor="startPage" className="text-sm font-medium"> 
                  Start Page 
                </Label>
                <Input
                  id="startPage"
                  type="number"
                  placeholder="e.g., 71"
                  value={startPage}
                  onChange={(e) => setStartPage(e.target.value)}
                  min="1"
                  max={totalPages}
                  className="mt-1"
                />
              </div>
              {/* Last page yang dia nak baca */}
              <div>
                <Label htmlFor="endPage" className="text-sm font-medium">
                  End Page (optional - leave empty for single page)
                </Label>
                <Input
                  id="endPage"
                  type="number"
                  placeholder="e.g., 72"
                  value={endPage}
                  onChange={(e) => setEndPage(e.target.value)}
                  min="1"
                  max={totalPages}
                  className="mt-1"
                />
              </div> 
            </div>

            <div className="mb-4">
              <label className="flex items-center space-x-2 text-sm">
                <input
                  type="checkbox"
                  checked={autoGenerateTable}
                  onChange={(e) => setAutoGenerateTable(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span>Auto-generate Excel table (uses more API calls)</span>
              </label>
              <p className="text-xs text-gray-500 mt-1">
                💡 Unchecked by default to avoid rate limits. You can manually generate tables after JSON formatting.
              </p>
            </div>

            <div className="flex gap-3">
              <Button 
                onClick={extractPagesText} 
                disabled={loading || !startPage || totalPages === 0}
                className="flex-1"
              >
                {loading ? 'Extracting...' : 'Extract Text'}
              </Button>
              <Button 
                onClick={clearAll}
                disabled={loading || processingWithAI || generatingTable}
                variant="outline"
                className="px-6"
              >
                🗑️ Clear
              </Button>
            </div>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-800 text-sm">❌ {error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {pageTexts.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Extracted Content</h2>
              <Button 
                onClick={processWithAI}
                disabled={processingWithAI}
                className="bg-green-600 hover:bg-green-700"
              >
                {processingWithAI ? '🤖 Processing...' : '🤖 Format as JSON'}
              </Button>
            </div>

            {extractedData && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    ✨ Formatted JSON Data
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-gray-900 p-4 rounded-lg border overflow-auto max-h-96">
                      <pre className="text-green-400 text-sm font-mono leading-relaxed">
                        {JSON.stringify(extractedData, null, 2)}
                      </pre>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">
                        📊 Excel Table Format (Tab-separated for easy copy/paste)
                      </Label>
                      <textarea
                        readOnly
                        value={generatingTable ? 'Generating table with AI...' : excelTableData}
                        className="w-full h-40 p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Table data will appear here..."
                        onClick={(e) => {
                          const target = e.target as HTMLTextAreaElement
                          target.select()
                        }}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        💡 Click on the text area to select all, then Ctrl+C (or Cmd+C) to copy. 
                        You can paste this directly into Excel, Google Sheets, or any spreadsheet application.
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Button 
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(extractedData, null, 2))
                      }}
                      variant="outline"
                      size="sm"
                    >
                      📋 Copy JSON
                    </Button>
                    <Button 
                      onClick={() => {
                        const dataStr = JSON.stringify(extractedData, null, 2)
                        const dataBlob = new Blob([dataStr], {type: 'application/json'})
                        const url = URL.createObjectURL(dataBlob)
                        const link = document.createElement('a')
                        link.href = url
                        
                        const filename = Array.isArray(extractedData) 
                          ? 'table-data.json' 
                          : 'livestock-data.json'
                        link.download = filename
                        
                        link.click()
                        URL.revokeObjectURL(url)
                      }}
                      variant="outline"
                      size="sm"
                    >
                      💾 Download JSON
                    </Button>
                    <Button 
                      onClick={downloadCSV}
                      variant="outline"
                      size="sm"
                      className="bg-green-50 hover:bg-green-100 border-green-300"
                    >
                      📊 Download CSV
                    </Button>
                    <Button 
                      onClick={() => {
                        if (excelTableData) {
                          navigator.clipboard.writeText(excelTableData)
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="bg-blue-50 hover:bg-blue-100 border-blue-300"
                      disabled={generatingTable || !excelTableData}
                    >
                      📋 Copy Excel Table
                    </Button>
                    <Button 
                      onClick={() => {
                        if (extractedData) {
                          generateTableData(extractedData)
                        }
                      }}
                      variant="outline"
                      size="sm"
                      className="bg-purple-50 hover:bg-purple-100 border-purple-300"
                      disabled={generatingTable || !extractedData}
                    >
                      {excelTableData.includes('Click "🔄 Generate Table"') ? '🔄 Generate Table' : '🔄 Regenerate Table'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {pageTexts.map((pageData, index) => (
              <Card key={pageData.pageNumber}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    📄 Page {pageData.pageNumber}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg border">
                    <pre className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed">
                      {pageData.text || 'No text found on this page'}
                    </pre>
                  </div>
                </CardContent>
                {index < pageTexts.length - 1 && <Separator className="my-4" />}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
