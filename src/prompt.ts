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
Extract the table data below into structured JSON.
Columns:

State

Number of Agriculture Holding

Production Quantity (Head)

Sales Quantity (Head)

Sales Value (RM '000)

Raw text:

Jadual 11.0: Parameter Utama bagi Ternakan Ayam/Itik mengikut Negeri, Malaysia, 2023  Table 11.0: Key Parameters for Chicken/Duck by State, Malaysia, 2023  Jadual 11.0: Parameter Utama bagi Ternakan Ayam/Itik mengikut Negeri, Malaysia, 2023  Table 11.0: Key Parameters for Chicken/Duck by State, Malaysia, 2023  Negeri  State  Bilangan Pegangan  Pertanian  Number of Agriculture  Holding  Kuantiti Pengeluaran  (Ekor)  Production Quantity  (Head)  Kuantiti Jualan  (Ekor)  Sales Quantity  (Head)  Nilai Jualan  (RM '000)  Sales Value  (RM '000)  Malaysia   8,263   1,002,863,083.4   915,120,757.8   13,310,105.96  Johor   585   231,017,572.0   204,649,152.0   2,971,240.43  Kedah   314   97,494,694.0   96,492,728.0   1,333,762.44  Kelantan   1,604   13,303,037.0   12,815,507.0   168,723.05  Melaka   301   29,428,183.0   21,738,484.0   319,605.48  Negeri Sembilan   527   119,951,574.0   106,935,064.0   1,436,504.20  Pahang   384   57,230,358.0   56,008,503.0   787,550.08  Pulau Pinang   113   68,430,817.0   67,406,826.0   909,662.33  Perak   585   181,780,523.0   172,232,892.0   2,780,271.13  Perlis   105   7,744,675.0   7,681,298.0   100,203.34  Selangor   422   76,985,823.0   73,654,617.0   1,089,141.74  Terengganu   1,987   13,302,378.0   12,546,416.0   167,624.42  Sabah   593   81,196,290.4   73,837,314.8   1,118,509.22  Sarawak   734   24,775,052.0   9,080,482.0   126,468.50  W.P. Kuala Lumpur   3   243.0   200.0   8.15  W.P. Labuan   29   221,864.0   41,274.0   831.46  W.P. Putrajaya   -   .   .   .  Sumber: Banci Pertanian 2024  Source: Agriculture Census 2024  * Nota:  1. Analisa pada 28 Mei 2025  2. Negeri merujuk kepada lokasi aktiviti pertanian  * Notes:  1. Analysis as at 28 May 2025  2. State refers to agriculture activities' location 345


IMPORTANT: Return ONLY valid JSON without any markdown formatting, explanations, or code blocks. Do not wrap the JSON in code block markers.

Return the data in the exact format:

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
  ...
]`;