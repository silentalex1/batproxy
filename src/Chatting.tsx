import PageChrome from './PageChrome';
import SubNavbar from './SubNavbar';
import { AmbientBg, SideRail } from './Chrome';

export default function Chatting() {
  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <PageChrome />
      <AmbientBg />
      <SideRail />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SubNavbar />

        <main className="flex-1 flex flex-col items-center justify-center px-4 pb-16 text-center sm:pl-16">
          <h1 className="text-3xl font-extrabold tracking-tight mb-6" style={{ color: 'var(--bp-accent)' }}>
            Community
          </h1>
          <div className="w-full max-w-xl bg-black/40 border border-white/10 rounded-2xl p-10 backdrop-blur-md">
            <svg className="w-12 h-12 text-purple-300 mx-auto mb-5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
            </svg>
            <p className="text-white text-lg font-medium leading-relaxed">
              Chat room is still being developed.
            </p>
            <p className="text-gray-400 text-sm mt-3">Please wait.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
