
const JUDGE0_API_URL = "https://judge0-ce.p.rapidapi.com";
const API_KEY = "8f596800e4msh08195884220a91fp175c80jsnab3c93d55017";

// Available language options with Judge0
export const languageOptions = [
  { id: 63, name: "JavaScript (Node.js 12.14.0)" },
  { id: 71, name: "Python (3.8.1)" },
  { id: 62, name: "Java (OpenJDK 13.0.1)" },
  { id: 54, name: "C++ (GCC 9.2.0)" },
  { id: 50, name: "C (GCC 9.2.0)" },
  { id: 51, name: "C# (Mono 6.6.0.161)" },
  { id: 68, name: "PHP (7.4.1)" },
  { id: 78, name: "Ruby (2.7.0)" },
  { id: 82, name: "SQL (SQLite 3.27.2)" },
  { id: 83, name: "Swift (5.1.3)" },
];

interface SubmissionResult {
  token?: string;
  status?: {
    id: number;
    description: string;
  };
  stdout?: string;
  stderr?: string;
  compile_output?: string;
  time?: string;
  memory?: string;
}

// Function to submit code for compilation
export const submitCode = async (languageId: number, sourceCode: string, stdin: string = ""): Promise<SubmissionResult> => {
  const options = {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-RapidAPI-Key": API_KEY,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    },
    body: JSON.stringify({
      language_id: languageId,
      source_code: sourceCode,
      stdin: stdin,
    }),
  };

  try {
    // Submit the code and get the token
    const response = await fetch(`${JUDGE0_API_URL}/submissions`, options);
    const result = await response.json() as SubmissionResult;
    
    if (result.token) {
      return await getSubmissionResult(result.token);
    } else {
      throw new Error("No token received from Judge0 API");
    }
  } catch (error) {
    console.error("Error submitting code:", error);
    throw error;
  }
};

// Function to get the result of a submission by token
export const getSubmissionResult = async (token: string): Promise<SubmissionResult> => {
  const options = {
    method: "GET",
    headers: {
      "X-RapidAPI-Key": API_KEY,
      "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
    },
  };

  try {
    // Poll for the submission result until it's ready
    let result: SubmissionResult = { status: { id: 1, description: "Processing" } };
    
    while (
      result.status?.id === 1 || // In Queue
      result.status?.id === 2    // Processing
    ) {
      const response = await fetch(
        `${JUDGE0_API_URL}/submissions/${token}`,
        options
      );
      result = await response.json();
      
      if (result.status?.id !== 1 && result.status?.id !== 2) {
        break;
      }
      
      // Wait before polling again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    
    return result;
  } catch (error) {
    console.error("Error getting submission result:", error);
    throw error;
  }
};
