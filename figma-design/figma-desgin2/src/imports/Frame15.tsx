import img79 from "figma:asset/0d76c941b6498b0075eef088c1d6b2bb07c7908c.png";
import img81 from "figma:asset/9926486361fa94d64aa031f0e3b7970dde9c2e0c.png";
import img93 from "figma:asset/c17c68f8e18c5c1c1648399fb28175ffe6cb4326.png";
import img41 from "figma:asset/d429c39f6867b5ce2d27cfc5508281622d539613.png";

export default function Frame() {
  return (
    <div className="bg-white relative size-full overflow-hidden">
      <div className="absolute left-[133px] size-[464px] top-[311px]" data-name="79">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={img79} />
      </div>
      <div className="absolute flex items-center justify-center left-[122px] size-[343px] top-[524px]" style={{ "--transform-inner-width": "1200", "--transform-inner-height": "19" } as React.CSSProperties}>
        <div className="flex-none rotate-90">
          <div className="relative size-[343px]" data-name="81">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={img81} />
          </div>
        </div>
      </div>
      <div className="absolute left-[-122px] size-[255px] top-[417px]" data-name="93">
        <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={img93} />
      </div>
      <div className="absolute flex items-center justify-center left-[-10px] size-[308px] top-[614px]">
        <div className="flex-none rotate-180">
          <div className="relative size-[308px]" data-name="41">
            <img alt="" className="absolute inset-0 max-w-none object-cover pointer-events-none size-full" src={img41} />
          </div>
        </div>
      </div>
      <p className="-translate-x-1/2 absolute font-['Lust:Regular',sans-serif] leading-[48px] left-[75.5px] not-italic text-[#525261] text-[20px] text-center top-[26px]">PRẞM</p>
      <p className="-translate-x-1/2 absolute font-['Gilroy-Regular:☞',sans-serif] leading-[24px] left-1/2 not-italic text-[#6d6d82] text-[20px] text-center top-[293px] w-[211px] whitespace-pre-wrap">Scroll through Instagram to start analyzing posts.</p>
    </div>
  );
}