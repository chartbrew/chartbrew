import React, { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button } from "@heroui/react";
import { Link, useNavigate } from "react-router";

import cbLogoDark from "../assets/cb_logo_dark.svg";
import cbLogoLight from "../assets/cb_logo_light.svg";
import { useTheme } from "../modules/ThemeContext";
import { clearUser, selectUser } from "../slices/user";
import { removeAuthToken } from "../modules/auth";

function UserInvite() {
  const navigate = useNavigate();
  const fetchRef = useRef(null);
  const dispatch = useDispatch();
  const user = useSelector(selectUser);
  const { isDark } = useTheme();

  useEffect(() => {
    if (user.id && !fetchRef.current) {
      fetchRef.current = true;
      redirectUser("login");
    }
  }, [user]);

  const redirectUser = async (route) => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    removeAuthToken();
    await dispatch(clearUser(true));

    setTimeout(() => {
      if (route === "login") {
        navigate(`/login?inviteToken=${token}`);
      } else {
        navigate(`/signup?inviteToken=${token}`);
      }
    }, 100);
  };

  return (
    <div className="min-h-screen bg-surface-secondary px-6 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between gap-12">
        <header className="flex flex-col items-center justify-center">
          <Link to="/">
            <img
              src={isDark ? cbLogoDark : cbLogoLight}
              className="w-[150px]"
              alt="Chartbrew logo"
            />
          </Link>
        </header>

        <main className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-md">
            <div className="space-y-2 text-center">
              <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground font-tw">
                You&apos;ve been invited to join Chartbrew
              </h1>
              <p className="text-sm text-muted">
                Please select an option below
              </p>
            </div>

            <div className="h-8" />

            <div className="space-y-3">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                onPress={() => redirectUser("signup")}
              >
                Create a new account
              </Button>
              <Button
                variant="outline"
                fullWidth
                size="lg"
                onPress={() => redirectUser("login")}
              >
                Login with an existing account
              </Button>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default UserInvite;
