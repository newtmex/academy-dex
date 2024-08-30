"use client";

import AddLiquidity from "./AddLiquidity";
import ClaimLpRewards from "./ClaimLpRewards";
import PortfolioDistribution from "./PortfolioDistribution";
import Sidebar from "./Sidebar";
import StakingAndGovernace from "./StakingAndGovernace";
import Swap from "./Swap";
import TopBar from "./TopBar";
import Voting from "./Voting";
import ReferralCard from "~~/components/ReferralCard";
import { useContentPanel } from "~~/hooks/useContentPanel";

export default function Dashboard() {
  const { toggleContentPanel } = useContentPanel();

  return (
    <>
      <TopBar />
      <div onClick={toggleContentPanel} className="content-panel-toggler">
        <i className="os-icon os-icon-grid-squares-22"></i>
        <span>Sidebar</span>
      </div>
      <div className="content-i">
        <div className="content-box" style={{ minHeight: "95vh" }}>
          <div className="row">
            <div className="col-sm-12 col-lg-6">
              <div className="justify-content-between mobile-full-width">
                <Swap />
              </div>
              <div className="element-wrapper pb-4 mb-4 border-bottom">
                <div className="element-box-tp">
                  <AddLiquidity />
                  <a className="btn btn-grey" href="#">
                    <i className="os-icon os-icon-log-out"></i>
                    <span>Remove Liquidity</span>
                  </a>
                  <ClaimLpRewards />
                </div>
              </div>
            </div>

            <div className="col-sm-2 d-none d-lg-block">
              <PortfolioDistribution />
            </div>

            <div className="col-sm-4 d-none d-lg-block">
              <StakingAndGovernace />
              <ReferralCard />
            </div>
          </div>
          <div className="row">
            <div className="col-12 col-xxl-8">
              <Voting />
            </div>
            <div className="col-sm-4"></div>
          </div>
        </div>

        <Sidebar />
      </div>
    </>
  );
}
