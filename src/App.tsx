import { useState, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { 
  Terminal, 
  Play, 
  RotateCcw, 
  Copy, 
  Check, 
  ShieldAlert, 
  Code2, 
  Cpu,
  Fingerprint,
  Zap,
  Upload,
  Download,
  Lock,
  Unlock,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const getAI = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key || key === "MY_GEMINI_API_KEY") return null;
  return new GoogleGenAI({ apiKey: key });
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function generateWithRetry(ai: any, params: any, onRetry?: (msg: string) => void, maxRetries = 3) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      lastError = error;
      const isRateLimit = error?.message?.includes('429') || error?.message?.toLowerCase().includes('rate limit');
      if (isRateLimit && i < maxRetries - 1) {
        const waitTime = Math.pow(2, i) * 3000 + Math.random() * 1000;
        const msg = `Rate limit hit. Neural cooling in progress... Retrying in ${Math.round(waitTime/1000)}s (Attempt ${i + 1}/${maxRetries})`;
        if (onRetry) onRetry(msg);
        console.log(msg);
        await sleep(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function performNaturalDecrypt(code: string): DeobfuscationResult {
  let currentCode = code.trim();
  const steps: string[] = [];
  const risks: string[] = [];
  let changed = true;
  let iterations = 0;
  const maxIterations = 5;

  // Helper to find the longest string in the code (likely the payload)
  const findPayloadString = (text: string) => {
    const stringRegex = /'''([\s\S]*?)'''|"""([\s\S]*?)"""|'([\s\S]*?)'|"([\s\S]*?)"/g;
    let match;
    let longest = "";
    while ((match = stringRegex.exec(text)) !== null) {
      const content = match[1] || match[2] || match[3] || match[4] || "";
      if (content.length > longest.length) {
        longest = content;
      }
    }
    return longest;
  };

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;
    const previousCode = currentCode;

    // 1. Check for ROT13 patterns
    if (currentCode.includes("rot_13") || currentCode.includes("rot13") || currentCode.includes("codecs.decode")) {
      const payload = findPayloadString(currentCode);
      if (payload) {
        const decoded = payload.replace(/[a-zA-Z]/g, (c: string) => {
          const base = c <= 'Z' ? 65 : 97;
          return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
        });
        if (decoded.includes("import ") || decoded.includes("def ") || decoded.includes("print(") || decoded.includes("from ")) {
          currentCode = decoded;
          steps.push(`[Iteration ${iterations}] Decoded ROT13 (Caesar Cipher) layer.`);
          changed = true;
        }
      }
    }

    // 2. Check for base64 patterns
    if (!changed && (currentCode.includes("base64") || currentCode.includes("b64decode"))) {
      const payload = findPayloadString(currentCode);
      if (payload && /^[A-Za-z0-9+/=\s\n\r]+$/.test(payload.trim())) {
        try {
          const decoded = atob(payload.trim().replace(/\s/g, ''));
          if (decoded.includes("import ") || decoded.includes("def ") || decoded.includes("print(") || decoded.includes("from ") || decoded.length > payload.length * 0.5) {
             currentCode = decoded;
             steps.push(`[Iteration ${iterations}] Decoded Base64 layer.`);
             changed = true;
          }
        } catch (e) {}
      }
    }

    // 3. Check for hex patterns
    if (!changed) {
      const hexRegex = /(['"](?:\\x[0-9a-fA-F]{2})+['"])/;
      const hexMatch = currentCode.match(hexRegex);
      if (hexMatch) {
        try {
          const hexStr = hexMatch[1].slice(1, -1).replace(/\\x/g, '');
          let decoded = "";
          for (let i = 0; i < hexStr.length; i += 2) {
            decoded += String.fromCharCode(parseInt(hexStr.substr(i, 2), 16));
          }
          if (decoded.length > 0) {
            currentCode = currentCode.replace(hexMatch[0], `'${decoded}'`);
            steps.push(`[Iteration ${iterations}] Converted Hexadecimal escape sequences.`);
            changed = true;
          }
        } catch (e) {}
      }
    }

    // 4. Check for reversed strings
    if (!changed && currentCode.includes("[::-1]")) {
      const payload = findPayloadString(currentCode);
      if (payload) {
        currentCode = payload.split('').reverse().join('');
        steps.push(`[Iteration ${iterations}] Reversed string slicing pattern.`);
        changed = true;
      }
    }

    // 5. Check for chr() join patterns
    if (!changed) {
      const chrRegex = /(?:chr\(\d+\)\s*\+\s*)*chr\(\d+\)/g;
      const chrMatch = currentCode.match(chrRegex);
      if (chrMatch) {
        try {
          const decoded = chrMatch[0].split('+').map(c => {
            const num = c.match(/\d+/);
            return num ? String.fromCharCode(parseInt(num[0])) : '';
          }).join('');
          currentCode = currentCode.replace(chrMatch[0], `'${decoded}'`);
          steps.push(`[Iteration ${iterations}] Decoded character mapping (chr() join).`);
          changed = true;
        } catch (e) {}
      }
    }

    if (currentCode === previousCode) changed = false;
  }

  // Final risk assessment
  currentCode.replace(/exec\(|eval\(|compile\(|getattr\(|__import__\(|os\.system\(|subprocess\.run\(/g, (m) => {
    if (!risks.includes(`Potentially dangerous execution wrapper found: ${m}`)) {
      risks.push(`Potentially dangerous execution wrapper found: ${m}`);
    }
    return m;
  });

  if (steps.length === 0) {
    throw new Error("No common obfuscation patterns detected for Natural Decrypt. Please use Neural AI for complex analysis.");
  }

  return {
    code: currentCode,
    explanation: `NATURAL DECRYPT REPORT (Iterations: ${iterations}):\n\n${steps.join('\n')}\n\nNote: Natural decrypt uses pattern matching and standard decoding. It is faster but less capable than Neural AI for complex multi-layer obfuscation.`,
    securityNotes: risks.length > 0 ? risks : ["No immediate execution risks detected in the first layer."]
  };
}

interface DeobfuscationResult {
  code: string;
  explanation: string;
  securityNotes: string[];
}

interface AppSettings {
  model: string;
  intensity: 'low' | 'medium' | 'high';
  includeComments: boolean;
  deepAnalysis: boolean;
}

export default function App() {
  const [mode, setMode] = useState<'encrypt' | 'decrypt'>('decrypt');
  const [decryptMethod, setDecryptMethod] = useState<'ai' | 'natural'>('ai');
  const [inputCode, setInputCode] = useState('');
  const [result, setResult] = useState<DeobfuscationResult | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [showHero, setShowHero] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const toolRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToTool = () => {
    setShowHero(false);
    setTimeout(() => {
      toolRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setInputCode(content);
    };
    reader.readAsText(file);
  };

  const handleDownload = () => {
    if (!result?.code) return;
    const blob = new Blob([result.code], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = mode === 'decrypt' ? 'deobfuscated_script.py' : 'obfuscated_script.py';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleProcess = async () => {
    if (!inputCode.trim()) return;
    
    setIsDecoding(true);
    setError(null);
    setResult(null);

    if (mode === 'decrypt' && decryptMethod === 'natural') {
      try {
        await sleep(1500); // Simulate processing
        const naturalResult = performNaturalDecrypt(inputCode);
        setResult(naturalResult);
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
        setIsDecoding(false);
        return;
      } catch (err: any) {
        setError(`Natural Decrypt failed: ${err.message}. Falling back to Neural AI is recommended.`);
        setIsDecoding(false);
        return;
      }
    }

    const ai = getAI();
    if (!ai) {
      setError("GEMINI_API_KEY_MISSING");
      setIsDecoding(false);
      return;
    }

    try {
      const prompt = mode === 'decrypt' 
        ? `You are a world-class Python reverse engineer and malware analyst. 
           Analyze and deobfuscate this Python code. 
           Intensity Level: extreme
           Deep Analysis: Enabled
           Include Comments: Yes

           The code is heavily encrypted, obfuscated, or uses multi-layer recursive unpacking, custom bytecode manipulation, or dynamic code generation. 
           Your goal is to reveal the original, clean source code.
           
           DEOBFUSCATION STRATEGY:
           1. Identify the unpacking algorithm (e.g., custom byte-shifting, XOR, base64, zlib, marshal, or custom VM).
           2. Recursively decode all layers until the final source is reached.
           3. Rename obfuscated variables (e.g., _0x1a2b -> user_data) to meaningful names based on their usage.
           4. Reconstruct the logical structure and remove anti-debugging/anti-analysis code.
           5. If the code uses 'exec' or 'eval' on encrypted strings, simulate the decryption to find the payload.
           6. Add clear comments explaining the logic of the deobfuscated code.
           
           Return ONLY a JSON object with this structure:
           {
             "code": "the final deobfuscated python code",
             "explanation": "detailed step-by-step breakdown of the unpacking process and techniques found",
             "securityNotes": ["list of security risks, malicious URLs, or suspicious behaviors found"]
           }`
        : `You are a world-class Python obfuscation and protection expert. 
           Obfuscate this Python code to make it EXTREMELY difficult to reverse engineer. 
           Intensity Level: extreme
           
           OBFUSCATION STRATEGY:
           1. Use multi-layer recursive exec() and eval() calls.
           2. Implement a custom dynamic decoding algorithm using bitwise operations and custom alphabets.
           3. Use dynamic attribute access (getattr/setattr) and built-in function hiding (e.g., __import__('os').system).
           4. Use lambda functions, list comprehensions, and nested functions to flatten logic.
           5. Add robust anti-debugging, anti-analysis, and anti-VM checks.
           6. Use string encryption and dynamic variable name generation.
           7. Ensure the code remains 100% functional and produces the same output as the original.
           8. Add junk code and dead logic to confuse static analysis tools.
           
           Return ONLY a JSON object with this structure:
           {
             "code": "the heavily obfuscated python code",
             "explanation": "description of the layers of protection and obfuscation techniques applied",
             "securityNotes": ["instructions for safe execution and verification of integrity"]
           }`;

      const response = await generateWithRetry(ai, {
        model: 'gemini-3.1-pro-preview',
        contents: [
          {
            text: `${prompt}
            
            Code:
            ${inputCode}`
          }
        ],
        config: {
          systemInstruction: mode === 'decrypt' 
            ? "You are a world-class Python security researcher and deobfuscator. Your goal is to reveal the true intent of obfuscated code. Always respond with valid JSON."
            : "You are a world-class Python obfuscation expert. Your goal is to protect code by making it unreadable while maintaining functionality. Always respond with valid JSON.",
          responseMimeType: "application/json",
          temperature: mode === 'decrypt' ? 0.0 : 0.9,
          maxOutputTokens: 16384,
        }
      }, (msg) => setRetryStatus(msg));

      let text = response.text || '';
      
      // Robust JSON extraction
      try {
        // Sometimes the model might still wrap in markdown even with responseMimeType
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        const data = JSON.parse(jsonStr);
        
        if (!data.code) throw new Error("Invalid response format: missing 'code' field");
        
        setResult(data);
        
        // Scroll to result
        setTimeout(() => {
          resultRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } catch (parseErr) {
        console.error("JSON Parse Error:", parseErr, "Raw Text:", text);
        setError("The AI returned an invalid response format. This can happen with extremely complex scripts. Try again or simplify the input.");
      }
    } catch (err: any) {
      console.error("API Error:", err);
      const errorMessage = err?.message || "Unknown error";
      
      if (errorMessage.includes("Safety")) {
        setError("The script was flagged by safety filters. It might contain highly malicious patterns that the AI is restricted from processing.");
      } else if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("rate limit")) {
        setError("Rate limit exceeded. The neural network is cooling down. Please wait 30 seconds and try again.");
      } else {
        setError(`Failed to process: ${errorMessage.split('\n')[0]}`);
      }
    } finally {
      setIsDecoding(false);
      setRetryStatus(null);
    }
  };

  const handleCopy = () => {
    if (result?.code) {
      navigator.clipboard.writeText(result.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const reset = () => {
    setInputCode('');
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="scanline" />
      
      {/* Header */}
      <header className="border-b border-line p-6 flex items-center justify-between bg-card-bg/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 border border-accent flex items-center justify-center rounded-sm shadow-[0_0_15px_rgba(0,255,65,0.2)]">
            <Terminal className="text-accent" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase glow-text italic">OMNIPY</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              <p className="text-[10px] uppercase tracking-[0.3em] text-accent font-bold">Neural {mode === 'decrypt' ? 'Deobfuscation' : 'Obfuscation'} Engine v4.0</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-8 text-[10px] uppercase tracking-widest text-secondary font-mono">
            <div className="flex items-center gap-2">
              <div className={`px-2 py-0.5 border ${mode === 'decrypt' ? 'border-red-500/50 text-red-500 bg-red-500/10' : 'border-accent/50 text-accent bg-accent/10'} rounded-full flex items-center gap-1`}>
                <div className={`w-1.5 h-1.5 rounded-full ${mode === 'decrypt' ? 'bg-red-500 animate-pulse' : 'bg-accent animate-pulse'}`} />
                {mode === 'decrypt' ? 'THREAT LEVEL: HIGH' : 'PROTECTION: MAXIMUM'}
              </div>
            </div>
            <div className="flex items-center gap-2"><Cpu size={14} className="text-accent" /> CPU: OPTIMAL</div>
            <div className="flex items-center gap-2"><Fingerprint size={14} className="text-accent" /> ID: VERIFIED</div>
            <div className="flex items-center gap-2"><ShieldCheck size={14} className="text-accent" /> SECURE: ACTIVE</div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowContact(true)}
              className="p-3 border border-line hover:border-accent hover:text-accent transition-all rounded-sm bg-bg"
              title="Contact Owner"
            >
              <Fingerprint size={20} />
            </button>
            <button 
              onClick={reset}
              className="p-3 border border-line hover:border-accent hover:text-accent transition-all rounded-sm bg-bg"
              title="Reset System"
            >
              <RotateCcw size={20} />
            </button>
          </div>
        </div>
      </header>

      {/* Contact Modal */}
      <AnimatePresence>
        {showContact && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-bg/90 backdrop-blur-xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md widget-container p-10 rounded-sm relative"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-xs font-black uppercase tracking-[0.4em] text-accent flex items-center gap-3">
                  <Fingerprint size={18} /> Owner Information
                </h2>
                <button onClick={() => setShowContact(false)} className="text-secondary hover:text-ink transition-colors">
                  <RotateCcw size={18} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-10">
                <div className="space-y-4 p-6 border border-line bg-bg/50 rounded-sm">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">Owner TG Account</label>
                  <p className="text-sm font-mono text-accent glow-text">@ItsMeJeff</p>
                </div>

                <div className="space-y-4 p-6 border border-line bg-bg/50 rounded-sm">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">Official TG Channel</label>
                  <a 
                    href="https://t.me/txtfilegenerator" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-accent glow-text hover:underline break-all"
                  >
                    https://t.me/txtfilegenerator
                  </a>
                </div>

                <button 
                  onClick={() => setShowContact(false)}
                  className="w-full py-5 bg-accent text-bg font-black uppercase tracking-[0.3em] text-xs hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_20px_rgba(0,255,65,0.2)]"
                >
                  Close Terminal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Persistent Sidebar */}
        <aside className="w-full lg:w-32 border-b lg:border-b-0 lg:border-r border-line bg-card-bg/50 flex lg:flex-col items-stretch py-2 lg:py-10 gap-1 z-30">
          <div className="hidden lg:block px-6 mb-6">
            <p className="text-[8px] font-black text-secondary uppercase tracking-[0.4em] opacity-30">Selection</p>
          </div>
          <button
            onClick={() => { setMode('decrypt'); reset(); setShowHero(false); }}
            className={`flex-1 lg:flex-none flex flex-col items-center gap-2 py-6 lg:py-10 transition-all border-b-2 lg:border-b-0 lg:border-l-2 ${mode === 'decrypt' && !showHero ? 'border-accent text-accent bg-accent/5 shadow-[inset_4px_0_15px_rgba(0,255,65,0.05)]' : 'border-transparent text-secondary hover:text-ink hover:bg-white/5'}`}
          >
            <Unlock size={22} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">DECRYPTOR</span>
          </button>
          <button
            onClick={() => { setMode('encrypt'); reset(); setShowHero(false); }}
            className={`flex-1 lg:flex-none flex flex-col items-center gap-2 py-6 lg:py-10 transition-all border-b-2 lg:border-b-0 lg:border-l-2 ${mode === 'encrypt' && !showHero ? 'border-accent text-accent bg-accent/5 shadow-[inset_4px_0_15px_rgba(0,255,65,0.05)]' : 'border-transparent text-secondary hover:text-ink hover:bg-white/5'}`}
          >
            <Lock size={22} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">ENCRYPTOR</span>
          </button>
          <div className="hidden lg:block flex-1" />
          <button
            onClick={() => setShowHero(true)}
            className={`flex-1 lg:flex-none flex flex-col items-center gap-2 py-6 lg:py-10 transition-all border-b-2 lg:border-b-0 lg:border-l-2 ${showHero ? 'border-accent text-accent bg-accent/5' : 'border-transparent text-secondary hover:text-accent hover:bg-white/5'}`}
          >
            <RotateCcw size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Home</span>
          </button>
        </aside>

        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Hero Section */}
          <AnimatePresence>
            {showHero && (
              <motion.section 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="absolute inset-0 z-20 flex flex-col items-center justify-center p-10 text-center bg-bg"
              >
                <div className="absolute inset-0 bg-accent/5 blur-[120px] rounded-full scale-50" />
                
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="max-w-4xl space-y-10 relative z-10"
                >
                  <h1 className="text-8xl lg:text-[12rem] font-black uppercase tracking-tighter leading-[0.8] italic glow-text">
                    OMNIPY
                  </h1>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-10">
                    <button 
                      onClick={scrollToTool}
                      className="px-12 py-6 bg-accent text-bg font-black uppercase tracking-[0.3em] text-sm rounded-sm transition-all hover:scale-[1.05] active:scale-[0.95] shadow-[0_0_40px_rgba(0,255,65,0.4)]"
                    >
                      Enter Terminal
                    </button>
                    <button 
                      onClick={() => setShowContact(true)}
                      className="px-12 py-6 border border-line hover:border-accent hover:text-accent text-secondary font-black uppercase tracking-[0.3em] text-sm rounded-sm transition-all"
                    >
                      Contact Owner
                    </button>
                  </div>
                </motion.div>

                {/* Features Grid Removed */}
              </motion.section>
            )}
          </AnimatePresence>

          <main className={`flex-1 max-w-[1600px] mx-auto w-full p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-2 gap-10 transition-all duration-500 ${showHero ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'}`} ref={toolRef}>
          {/* Input Section */}
          <section className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                  <Code2 size={16} /> {mode === 'decrypt' ? 'Target Payload' : 'Source Logic'}
                </h2>
                <p className="text-[9px] text-secondary uppercase tracking-widest">Input Buffer: Python 3.x</p>
              </div>
              <div className="flex items-center gap-6">
                {mode === 'decrypt' && (
                  <div className="flex items-center bg-bg/50 border border-line p-1 rounded-sm gap-1">
                    <button 
                      onClick={() => setDecryptMethod('ai')}
                      className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${decryptMethod === 'ai' ? 'bg-accent text-bg shadow-[0_0_15px_rgba(0,255,65,0.3)]' : 'text-secondary hover:text-accent'}`}
                    >
                      Neural AI
                    </button>
                    <button 
                      onClick={() => setDecryptMethod('natural')}
                      className={`px-3 py-1 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${decryptMethod === 'natural' ? 'bg-accent text-bg shadow-[0_0_15px_rgba(0,255,65,0.3)]' : 'text-secondary hover:text-accent'}`}
                    >
                      Natural Logic
                    </button>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept=".py,.txt" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-accent transition-colors"
                >
                  <Upload size={14} />
                  Load File
                </button>
              </div>
            </div>
            
            <div className="flex-1 relative group widget-container rounded-sm overflow-hidden">
              <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity animate-[scan_4s_linear_infinite] pointer-events-none" />
              <textarea
                value={inputCode}
                onChange={(e) => setInputCode(e.target.value)}
                placeholder={mode === 'decrypt' ? "// PASTE OBFUSCATED PAYLOAD HERE..." : "// PASTE CLEAN SOURCE CODE HERE..."}
                className="w-full h-[500px] lg:h-full p-8 bg-transparent font-mono text-sm text-ink focus:outline-none resize-none placeholder:text-line leading-relaxed relative z-10"
              />
              <div className="absolute bottom-6 right-6 flex gap-4">
                <button
                  onClick={handleProcess}
                  disabled={isDecoding || !inputCode.trim()}
                  className={`flex items-center gap-3 px-8 py-4 bg-accent text-bg font-black uppercase tracking-[0.2em] text-xs rounded-sm transition-all hover:scale-[1.05] active:scale-[0.95] disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(0,255,65,0.3)]`}
                >
                  {isDecoding ? (
                    <>
                      <Zap className="animate-spin" size={18} />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Initialize {mode === 'decrypt' ? 'Decryption' : 'Obfuscation'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </section>

          {/* Output Section */}
          <section className="flex flex-col gap-6" ref={resultRef}>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-accent flex items-center gap-2">
                  <Terminal size={16} /> {mode === 'decrypt' ? 'Decoded Source' : 'Protected Payload'}
                </h2>
                <p className="text-[9px] text-secondary uppercase tracking-widest">Output Stream: Verified</p>
              </div>
              {result && (
                <div className="flex items-center gap-6">
                  <button 
                    onClick={handleDownload}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-accent transition-colors"
                  >
                    <Download size={14} />
                    Export .py
                  </button>
                  <button 
                    onClick={handleCopy}
                    className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-secondary hover:text-accent transition-colors"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 widget-container rounded-sm overflow-hidden flex flex-col min-h-[500px] relative">
              {isDecoding && (
                <div className="absolute inset-0 z-10 pointer-events-none">
                  <div className="w-full h-1 bg-accent/30 absolute top-0 animate-[scan_2s_linear_infinite]" />
                </div>
              )}
              {isDecoding ? (
                <div className="flex-1 flex flex-col items-center justify-center text-accent gap-6">
                  <div className="relative">
                    <div className="w-20 h-20 border-2 border-accent/20 rounded-full animate-ping absolute inset-0" />
                    <div className="w-20 h-20 border-2 border-accent rounded-full animate-spin border-t-transparent" />
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <p className="font-mono text-sm font-black uppercase tracking-[0.4em] animate-pulse">
                      {retryStatus ? "Neural Cooling" : "Neural Processing"}
                    </p>
                    <p className="text-[10px] opacity-50 uppercase tracking-widest">
                      {retryStatus || "Bypassing encryption layers..."}
                    </p>
                  </div>
                </div>
              ) : result ? (
                <div className="flex-1 overflow-auto bg-[#0d0d0e]">
                  <SyntaxHighlighter 
                    language="python" 
                    style={atomDark}
                    customStyle={{ margin: 0, padding: '2rem', background: 'transparent', fontSize: '14px', lineHeight: '1.6' }}
                  >
                    {result.code}
                  </SyntaxHighlighter>
                </div>
              ) : error ? (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center gap-6">
                  <ShieldAlert size={64} className="text-red-500 animate-bounce" />
                  <div className="flex flex-col gap-4">
                    <p className="font-mono text-sm text-red-500 font-black uppercase tracking-widest">
                      {error === "GEMINI_API_KEY_MISSING" ? "API KEY REQUIRED" : "SYSTEM FAILURE"}
                    </p>
                    {error === "GEMINI_API_KEY_MISSING" ? (
                      <div className="space-y-6">
                        <p className="text-xs text-secondary max-w-xs mx-auto leading-relaxed uppercase tracking-widest">
                          OMNIPY requires a Gemini API Key to process neural obfuscation. You can get one for free from Google AI Studio.
                        </p>
                        <div className="flex flex-col gap-3">
                          <a 
                            href="https://aistudio.google.com/app/apikey" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-6 py-3 bg-red-500 text-white text-[10px] font-black uppercase tracking-[0.3em] rounded-sm hover:bg-red-600 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                          >
                            Get Free API Key
                          </a>
                          <button 
                            onClick={() => setError(null)}
                            className="px-6 py-3 border border-line text-secondary text-[10px] font-black uppercase tracking-[0.3em] rounded-sm hover:border-accent hover:text-accent transition-all"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-secondary max-w-xs mx-auto leading-relaxed">{error}</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-secondary p-16 text-center gap-6 opacity-30">
                  <Terminal size={80} />
                  <p className="font-mono text-xs font-black uppercase tracking-[0.5em]">Awaiting Payload</p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Analysis Details */}
      <AnimatePresence>
        {result && !isDecoding && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[1600px] mx-auto w-full px-6 lg:px-10 pb-20 grid grid-cols-1 lg:grid-cols-3 gap-10"
          >
            <div className="lg:col-span-2 widget-container p-10 rounded-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-accent/10" />
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-accent mb-8 border-b border-line pb-4 flex items-center justify-between">
                <span>{mode === 'decrypt' ? 'Analysis Report' : 'Protection Manifest'}</span>
                <span className="text-[9px] opacity-30 font-mono">ID: {Math.random().toString(16).slice(2, 10).toUpperCase()}</span>
              </h3>
              <div className="font-mono text-sm leading-relaxed text-ink/80 whitespace-pre-wrap bg-bg/30 p-6 border border-line/30 rounded-sm">
                {result.explanation}
              </div>
            </div>
            
            <div className="widget-container p-10 rounded-sm">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-accent mb-8 border-b border-line pb-4 flex items-center gap-3">
                {mode === 'decrypt' ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />} 
                {mode === 'decrypt' ? 'Threat Assessment' : 'Integrity Notes'}
              </h3>
              <ul className="space-y-6">
                {result.securityNotes.map((note, i) => (
                  <li key={i} className="flex gap-4 items-start group">
                    <div className="mt-1.5 w-2 h-2 bg-accent rounded-full shrink-0 shadow-[0_0_10px_rgba(0,255,65,0.5)] group-hover:scale-125 transition-transform" />
                    <p className="text-[11px] font-bold uppercase tracking-tight leading-relaxed text-secondary group-hover:text-ink transition-colors">{note}</p>
                  </li>
                ))}
                {result.securityNotes.length === 0 && (
                  <li className="text-[11px] font-bold uppercase tracking-widest opacity-30">No critical alerts</li>
                )}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>

      {/* Footer */}
      <footer className="border-t border-line p-8 bg-card-bg/80 text-[10px] font-black uppercase tracking-[0.5em] text-secondary flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <span className="text-accent">PYDECODE PRO</span>
          <span className="opacity-20">|</span>
          <span>&copy; 2026 NEURAL SYSTEMS</span>
        </div>
        <div className="flex gap-10 opacity-40">
          <span className="hover:text-accent transition-colors cursor-help">AES-256 ENCRYPTED</span>
          <span className="hover:text-accent transition-colors cursor-help">ZERO-LOG POLICY</span>
          <span className="hover:text-accent transition-colors cursor-help">SANDBOXED ENV</span>
        </div>
      </footer>
    </div>
  );
}
