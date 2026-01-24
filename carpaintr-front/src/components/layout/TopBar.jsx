import { useEffect, useState } from "react";
import { Navbar, Nav, Loader, Stack } from "rsuite";
import { useNavigate } from "react-router-dom";
import { authFetch } from "../../utils/authFetch";

const TopBar = () => {
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const response = await authFetch("/api/v1/getcompanyinfo");
        if (response.ok) {
          const data = await response.json();
          setCompanyName(data.company_name);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error("Not logged in:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyInfo();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken"); // Remove the token
    setIsLoggedIn(false);
    navigate("/login");
  };

  return (
    <Navbar>
      <Navbar.Header>
        <h3 style={{ margin: 0 }}>Carpaintr</h3>
      </Navbar.Header>
      <Navbar.Body>
        <Nav>
          {loading ? (
            <Loader size="sm" />
          ) : (
            <>
              {isLoggedIn ? (
                <Stack>
                  <Nav.Item onClick={() => navigate("/calc")}>
                    Calculate
                  </Nav.Item>
                  <Nav.Item onClick={handleLogout}>Logout</Nav.Item>
                </Stack>
              ) : (
                <span>
                  <Nav.Item onClick={() => navigate("/login")}>Увійти</Nav.Item>
                  <Nav.Item onClick={() => navigate("/register")}>
                    Зареєструватися
                  </Nav.Item>
                </span>
              )}
            </>
          )}
        </Nav>
      </Navbar.Body>
      {isLoggedIn && (
        <div style={{ textAlign: "center", marginTop: "10px" }}>
          <h4>{companyName}</h4>
        </div>
      )}
    </Navbar>
  );
};

export default TopBar;
