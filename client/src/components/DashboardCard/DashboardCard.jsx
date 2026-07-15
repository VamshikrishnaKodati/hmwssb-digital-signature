import { useNavigate } from "react-router-dom";
import "./DashboardCard.css";

const routes = {
  "Prepare Estimate": "/prepare-estimate",
  "Estimates With Me": "/estimates",
  Reports: "/reports",
};

function DashboardCard({ title, color, icon }) {
  const navigate = useNavigate();

  return (
    <div
      className="dashboard-card"
      style={{ backgroundColor: color, cursor: "pointer" }}
      onClick={() => {
        const path = routes[title];
        if (path) navigate(path);
      }}
    >
      <div className="card-icon">{icon}</div>

      <h4>{title}</h4>
    </div>
  );
}

export default DashboardCard;