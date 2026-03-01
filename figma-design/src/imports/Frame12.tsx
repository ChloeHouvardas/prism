import img85 from "figma:asset/ac391d9b1ef22ff52f4210ca930f096c198715e5.png";
import img1 from "figma:asset/88e80d6d912c76f0da97dbeac4cbf888327d68c8.png";
import img91 from "figma:asset/241cdd1311bc02555f2722b8df1747416a8995e8.png";

function Frame2() {
  return (
    <div className="absolute h-[24px] left-1/2 -translate-x-1/2 top-[678px] w-[76px]">
      <svg className="absolute block size-full" fill="none" preserveAspectRatio="none" viewBox="0 0 76 24">
        <g id="Frame 14">
          <circle cx="24" cy="12" fill="var(--fill-0, black)" id="Ellipse 2" r="5" />
          <circle cx="52" cy="12" fill="var(--fill-0, #D9D9D9)" id="Ellipse 3" r="5" />
        </g>
      </svg>
    </div>
  );
}

function Frame() {
  return (
    <div className="absolute content-stretch flex h-[32px] items-center justify-center left-1/2 -translate-x-1/2 overflow-clip px-[20px] py-[10px] rounded-[30px] shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] top-[506px] w-[115px]" style={{ backgroundImage: "linear-gradient(155.556deg, rgba(202, 201, 201, 0.7) 66.181%, rgba(100, 99, 99, 0.4) 152.8%)" }}>
      <p className="font-['Gilroy-Medium:☞',sans-serif] leading-[48px] not-italic relative shrink-0 text-[#3f3f49] text-[14px] text-center">Next</p>
    </div>
  );
}

export default function Frame1() {
  return (
    <div className="bg-white relative size-full overflow-hidden">
      <div className="absolute left-[-203px] size-[452px] top-[555px]" data-name="85">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={img85} />
      </div>
      <div className="absolute aspect-[2048/2048] left-1/2 right-[calc(-43.68%-3.75px)] top-[439px]" data-name="1">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={img1} />
      </div>
      <div className="absolute left-[121px] size-[362px] top-[600px]" data-name="91">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={img91} />
      </div>
      <div className="absolute bg-[rgba(255,255,255,0.1)] backdrop-blur-[8px] h-[578px] left-[25px] rounded-[30px] top-[159px] w-full shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] border border-[rgba(255,255,255,0.2)]" style={{ background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.05) 100%)' }} />
      <Frame2 />
      <p className="-translate-x-1/2 absolute font-['Lust:Regular',sans-serif] leading-[48px] left-1/2 not-italic text-[#4B4B59] text-[60px] text-center top-[361px]" style={{ textShadow: 'inset 0px 4px 4px rgba(0, 0, 0, 0.25)' }}>PRẞM</p>
      <p className="-translate-x-1/2 absolute font-['Gilroy-Medium:☞',sans-serif] leading-[20px] left-1/2 not-italic text-[#3f3f49] text-[14px] text-center top-[437px] w-[230px] whitespace-pre-wrap">Clarify your understanding and stop the spread of misinformation</p>
      <Frame />
    </div>
  );
}