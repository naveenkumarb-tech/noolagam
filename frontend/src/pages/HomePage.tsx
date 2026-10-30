import { AtAGlance } from "../features/home/AtAGlance";
import { CurrentlyReading } from "../features/home/CurrentlyReading";
import { HomeHeader } from "../features/home/HomeHeader";
import { RecentlyAdded } from "../features/home/RecentlyAdded";
import { UpNext } from "../features/home/UpNext";

export function HomePage() {
  return (
    <div className="flex flex-col gap-5 lg:gap-7">
      <HomeHeader />
      <div className="flex flex-col gap-5 lg:gap-7">
        <div className="lg:order-1">
          <CurrentlyReading />
        </div>
        <div className="empty:hidden lg:order-2">
          <UpNext />
        </div>
        <div className="lg:order-first">
          <AtAGlance />
        </div>
        <div className="empty:hidden max-lg:hidden lg:order-3">
          <RecentlyAdded />
        </div>
      </div>
    </div>
  );
}
