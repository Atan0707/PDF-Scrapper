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
Extract the raw text into structured JSON and CSV.

Rules

Detect table type automatically (single-category, multi-category by state, or multi-category by district).

Parse numbers as numeric values (not strings).

Missing values (e.g. "." or "-") → return null in JSON, leave blank in CSV.

Nest districts inside their parent state (for Table 11.4).

Always output both JSON and CSV.

Raw text
[PASTE RAW OCR TEXT HERE]

✅ Expected JSON outputs

Case 1 – Single-category (Table 11.0):

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


Case 2 – Multi-category by State (Table 11.3):

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


Case 3 – Multi-category by District (Table 11.4):


[
  {
    "State": "Johor",
    "Totals": {
      "Individual": { "Sales Quantity (Head)": 2866142.0, "Sales Value (RM '000)": 48195.79 },
      "Establishment": { "Sales Quantity (Head)": 201783010.0, "Sales Value (RM '000)": 2923044.64 },
      "Agriculture Holding": { "Sales Quantity (Head)": 204649152.0, "Sales Value (RM '000)": 2971240.43 }
    },
    "Districts": [
      {
        "District": "Batu Pahat",
        "Individual": { "Sales Quantity (Head)": 237769.0, "Sales Value (RM '000)": 3770.66 },
        "Establishment": { "Sales Quantity (Head)": 64311684.0, "Sales Value (RM '000)": 890028.44 },
        "Agriculture Holding": { "Sales Quantity (Head)": 64549453.0, "Sales Value (RM '000)": 893799.10 }
      },
      {
        "District": "Johor Bahru",
        "Individual": { "Sales Quantity (Head)": 174893.0, "Sales Value (RM '000)": 2218.39 },
        "Establishment": { "Sales Quantity (Head)": 14929695.0, "Sales Value (RM '000)": 215643.96 },
        "Agriculture Holding": { "Sales Quantity (Head)": 15104588.0, "Sales Value (RM '000)": 217862.36 }
      }
    ]
  }
]

✅ Expected CSV outputs

Flattened version for Case 3 (district-level):

State,District,Individual Sales Quantity (Head),Individual Sales Value (RM '000),Establishment Sales Quantity (Head),Establishment Sales Value (RM '000),Agriculture Holding Sales Quantity (Head),Agriculture Holding Sales Value (RM '000)
Johor,Batu Pahat,237769.0,3770.66,64311684.0,890028.44,64549453.0,893799.10
Johor,Johor Bahru,174893.0,2218.39,14929695.0,215643.96,15104588.0,217862.36
Johor,Kluang,885628.0,13421.12,16054967.0,255248.72,16940595.0,268669.85
...
`;