import PageChrome from './PageChrome';
import SubNavbar from './SubNavbar';

export default function ApiDocs() {
  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <PageChrome />
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-repeat opacity-60"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
                              radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0)),
                              radial-gradient(1.5px 1.5px at 230px 190px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1px 1px at 300px 80px, #fff, rgba(0,0,0,0))`,
            backgroundSize: '350px 350px'
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-green-500/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <SubNavbar goBackLabel="< Go home" goBackTo="/dashboard" />

        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16 text-center">
          <h1 className="text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mb-6 drop-shadow-lg">
            API Documentation
          </h1>
          <div className="w-full max-w-xl bg-black/40 border border-white/10 rounded-2xl p-10 backdrop-blur-md">
            <p className="text-white text-lg font-medium leading-relaxed">
              Document, and our own API system for alot more other feature tools, is coming soon.
            </p>
            <p className="text-gray-400 text-sm mt-4 leading-relaxed">Stay updated join the discord server.</p>
            <a
              href="https://discord.gg/QreCHyeSpj"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-6 px-6 py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-white border border-indigo-500/30 transition-all text-sm font-medium"
            >
              Join the Discord
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
