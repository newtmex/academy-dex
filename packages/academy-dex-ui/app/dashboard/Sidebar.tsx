import { useContentPanel } from "~~/hooks/useContentPanel";
import UnwrapWEDU from "./UnwrapWEDU";

export default function Sidebar() {
  const { hideContentPanel } = useContentPanel();

  return (
    <div className="content-panel compact color-scheme-dark">
      <div onClick={hideContentPanel} className="content-panel-close">
        <i className="os-icon os-icon-close"></i>
      </div>

      <UnwrapWEDU />
    </div>
  );
}
