// Ni untuk extract general data daripada gambar (page yang awal-awal)
// export const PDF_EXTRACTION_PROMPT = `
// You are a data extraction specialist. Your task is to extract and format agricultural livestock data from Malaysian census text into structured JSON format.

// ## Input Format
// You will receive raw text extracted from a PDF containing livestock census data for Malaysia. The data can include various types of livestock such as:
// - Lembu (cattle)
// - Kerbau (buffalo) 
// - Kambing (goat)
// - Bebiri (sheep)
// - Babi (pig)
// - Or other livestock types

// ## Expected Data Structure
// The text contains:
// 1. **JUMLAH** (Total) - Overall totals for each livestock type
// 2. **PERTUBUHAN** (Organization) - Organization/company holdings
// 3. **INDIVIDU** (Individual) - Individual holdings  
// 4. **State-wise data** - Data for each Malaysian state with Individual and Organization breakdowns

// ## Output JSON Schema
// Return the data in this flexible JSON structure that adapts to the livestock types found in the text:

// \`\`\`json
// {
//   "title": "[Extract the title from the document]",
//   "year": "[Extract year, typically 2023]",
//   "source": "[Extract source, typically Banci Pertanian 2024]",
//   "livestock_types": ["lembu", "kerbau", "kambing", "bebiri", "babi"],
//   "summary": {
//     "jumlah": {
//       "total": 0,
//       "[livestock_type_1]": 0,
//       "[livestock_type_2]": 0
//     },
//     "pertubuhan": {
//       "total": 0,
//       "[livestock_type_1]": 0,
//       "[livestock_type_2]": 0
//     },
//     "individu": {
//       "total": 0,
//       "[livestock_type_1]": 0,
//       "[livestock_type_2]": 0
//     }
//   },
//   "states": {
//     "johor": {
//       "[livestock_type_1]": {
//         "individu": 0,
//         "pertubuhan": 0
//       },
//       "[livestock_type_2]": {
//         "individu": 0,
//         "pertubuhan": 0
//       }
//     },
//     "kedah": {
//       "[livestock_type_1]": {
//         "individu": 0,
//         "pertubuhan": 0
//       },
//       "[livestock_type_2]": {
//         "individu": 0,
//         "pertubuhan": 0
//       }
//     }
//     // ... continue for all 16 states/territories with the same structure
//   }
// }
// \`\`\`

// ## Extraction Rules

// 1. **Livestock Type Detection:**
//    - First, identify what types of livestock are mentioned in the document
//    - Common types: Lembu (cattle), Kerbau (buffalo), Kambing (goat), Bebiri (sheep), Babi (pig)
//    - Add all detected livestock types to the "livestock_types" array
//    - Use lowercase names in JSON (lembu, kerbau, kambing, bebiri, babi)

// 2. **Summary Data Extraction:**
//    - Look for patterns like "23,207 JUMLAH [Livestock1]: 21,439 [Livestock2]: 1,768"
//    - Extract total and individual livestock counts for JUMLAH
//    - Look for "764 PERTUBUHAN [Livestock1]: 710 [Livestock2]: 54"
//    - Extract total and individual livestock counts for PERTUBUHAN  
//    - Look for "INDIVIDU 22,443 [Livestock1]: 20,729 [Livestock2]: 1,714"
//    - Extract total and individual livestock counts for INDIVIDU
//    - Adapt the structure to match the livestock types found in the document

// 3. **State Data Extraction:**
//    - State data format varies based on livestock types present
//    - For 2 livestock types: "[Type1] [Type2] [type1_individu] [type1_pertubuhan] [type2_individu] [type2_pertubuhan]"
//    - For 1 livestock type: "[Type1] [type1_individu] [type1_pertubuhan]"
//    - Example with Lembu/Kerbau: "Lembu Kerbau 1,499 137 111 10" means:
//      - lembu.individu = 1,499, lembu.pertubuhan = 137  
//      - kerbau.individu = 111, kerbau.pertubuhan = 10
//    - Example with just Babi: "Babi 500 25" means:
//      - babi.individu = 500, babi.pertubuhan = 25
//    - If any value shows "-", convert it to 0
//    - States appear in this order: Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Pulau Pinang, Perak, Perlis, Selangor, Terengganu, Sabah, Sarawak, W.P Kuala Lumpur, W.P Labuan, W.P Putrajaya

// 4. **Number Formatting:**
//    - Remove all commas from numbers
//    - Convert "-" to 0
//    - Ensure all values are integers

// 5. **State Name Mapping:**
//    - Johor → johor
//    - Kedah → kedah  
//    - Kelantan → kelantan
//    - Melaka → melaka
//    - Negeri Sembilan → negeri_sembilan
//    - Pahang → pahang
//    - Pulau Pinang → pulau_pinang
//    - Perak → perak
//    - Perlis → perlis
//    - Selangor → selangor
//    - Terengganu → terengganu
//    - Sabah → sabah
//    - Sarawak → sarawak
//    - W.P Kuala Lumpur → wp_kuala_lumpur
//    - W.P Labuan → wp_labuan
//    - W.P Putrajaya → wp_putrajaya

// 6. **Livestock Name Mapping:**
//    - Lembu → lembu
//    - Kerbau → kerbau
//    - Kambing → kambing
//    - Bebiri → bebiri
//    - Babi → babi
//    - (Use lowercase for all livestock types in JSON)

// ## Important Notes:
// - Return ONLY the JSON object, no additional text or formatting
// - Dynamically adapt the JSON structure based on the livestock types found in the document
// - Ensure all numeric values are properly parsed as integers
// - If data for a state is missing, leave values as 0
// - Double-check that summary totals match the individual components
// - Be precise with the state data order and mapping
// - Include only the livestock types that are actually present in the document
// - Maintain the same structure for all states, using the detected livestock types

// ## Examples:

// **For Lembu/Kerbau document:**
// {
//   "livestock_types": ["lembu", "kerbau"],
//   "summary": {
//     "jumlah": { "total": 23207, "lembu": 21439, "kerbau": 1768 }
//   },
//   "states": {
//     "johor": {
//       "lembu": { "individu": 1499, "pertubuhan": 137 },
//       "kerbau": { "individu": 111, "pertubuhan": 10 }
//     }
//   }
// }

// **For Babi-only document:**
// {
//   "livestock_types": ["babi"],
//   "summary": {
//     "jumlah": { "total": 5000, "babi": 5000 }
//   },
//   "states": {
//     "johor": {
//       "babi": { "individu": 500, "pertubuhan": 25 }
//     }
//   }
// }

// Extract the data from the provided text and return the structured JSON according to this specification.
// `;

// Ni prompt untuk extract data from table
export const PDF_EXTRACTION_PROMPT = `
Extract the following raw text into structured data.
Rules:

Identify the correct table headers, even if repeated or noisy.

Parse numbers as numeric values (not strings).

If a value is missing (e.g. "." or "-"), return 0 in JSON and 0 in CSV.

Return both JSON and CSV.

For tables with sub-categories (Individual, Establishment, Agriculture Holding), nest them in JSON.

Raw text:

[PASTE RAW OCR TEXT HERE]


Expected JSON structure:

For single-category tables (like Table 11.0):

[
  {
    "State": "Malaysia",
    "Number of Agriculture Holding": 8263,
    "Production Quantity (Head)": 1002863083.4,
    "Sales Quantity (Head)": 915120757.8,
    "Sales Value (RM '000)": 13310105.96
  },
  {
    "State": "Johor",
    "Number of Agriculture Holding": 585,
    "Production Quantity (Head)": 231017572.0,
    "Sales Quantity (Head)": 204649152.0,
    "Sales Value (RM '000)": 2971240.43
  }
]


For multi-category tables (like Table 11.3):

[
  {
    "State": "Malaysia",
    "Individual": {
      "Number": 7143,
      "Sales Quantity (Head)": 15759231.8,
      "Sales Value (RM '000)": 273267.38
    },
    "Establishment": {
      "Number": 1120,
      "Sales Quantity (Head)": 899361526.0,
      "Sales Value (RM '000)": 13036838.58
    },
    "Agriculture Holding": {
      "Number": 8263,
      "Sales Quantity (Head)": 915120757.8,
      "Sales Value (RM '000)": 13310105.96
    }
  },
  {
    "State": "Johor",
    "Individual": {
      "Number": 371,
      "Sales Quantity (Head)": 2866142.0,
      "Sales Value (RM '000)": 48195.79
    },
    "Establishment": {
      "Number": 214,
      "Sales Quantity (Head)": 201783010.0,
      "Sales Value (RM '000)": 2923044.64
    },
    "Agriculture Holding": {
      "Number": 585,
      "Sales Quantity (Head)": 204649152.0,
      "Sales Value (RM '000)": 2971240.43
    }
  }
]


Expected CSV output for multi-category tables (flattened):

State,Individual Number,Individual Sales Quantity (Head),Individual Sales Value (RM '000),Establishment Number,Establishment Sales Quantity (Head),Establishment Sales Value (RM '000),Agriculture Holding Number,Agriculture Holding Sales Quantity (Head),Agriculture Holding Sales Value (RM '000)
Malaysia,7143,15759231.8,273267.38,1120,899361526.0,13036838.58,8263,915120757.8,13310105.96
Johor,371,2866142.0,48195.79,214,201783010.0,2923044.64,585,204649152.0,2971240.43
Kedah,228,194140.0,3309.45,86,96298588.0,1330452.98,314,96492728.0,1333762.44
...

]`;