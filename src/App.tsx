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

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  const [inputCode, setInputCode] = useState('');
  const [result, setResult] = useState<DeobfuscationResult | null>(null);
  const [isDecoding, setIsDecoding] = useState(false);
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

    if (!process.env.GEMINI_API_KEY) {
      setError("Gemini API Key is missing. Please check your environment configuration.");
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

      const response = await ai.models.generateContent({
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
        }
      });

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
      } else if (errorMessage.includes("429")) {
        setError("Rate limit exceeded. Please wait a moment before trying again.");
      } else {
        setError(`Failed to decode: ${errorMessage.split('\n')[0]}`);
      }
    } finally {
      setIsDecoding(false);
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
                className="w-full h-[500px] lg:h-full p-8 bg-transparent font-mono text-sm text-ink 
