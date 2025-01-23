import React, { useState } from "react";
import { connect, useDispatch } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import {
  Button, Card, Spacer, Input, Link as LinkNext, Avatar, CardHeader, CardBody, Divider,
} from "@heroui/react";
import { LuArrowRight, LuLock, LuMail, LuUser } from "react-icons/lu";

import { addTeamMember } from "../slices/team";
import {
  required,
  email as emailValidation,
  password as passwordValidation
} from "../config/validations";
import {
  negative, positive, secondary,
} from "../config/colors";
import signupBackground from "../assets/dashboards_background.webp";
import Row from "../components/Row";
import Text from "../components/Text";
import { createUser, createInvitedUser } from "../slices/user";
import SimpleNavbar from "../components/SimpleNavbar";
import circularCity from "../assets/circular_city.webp";
import moomken from "../assets/moomken.png";

const testimonialAvatar = "https://cdn2.chartbrew.com/skyguy.webp";

/*
  The Signup page
*/
function Signup() {
  const [loading, setLoading] = useState(false);
  const [addedToTeam, setAddedToTeam] = useState(false);
  const [errors, setErrors] = useState({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupError, setSignupError] = useState("");

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const submitUser = () => {
    const params = new URLSearchParams(document.location.search);

    if (required(name)) {
      setErrors({ ...errors, name: required(name) });
      return;
    }

    if (emailValidation(email)) {
      setErrors({ ...errors, email: emailValidation(email) });
      return;
    }

    if (passwordValidation(password)) {
      setErrors({ ...errors, password: passwordValidation(password) });
      return;
    }

    setLoading(true);
    if (params.has("inviteToken")) {
      _createInvitedUser({ name, email, password }, params.get("inviteToken"));
    } else {
      dispatch(createUser({ name, email, password }))
        .then(() => {
          setLoading(false);
          navigate("/?welcome=true");
        })
        .catch((err) => {
          setLoading(false);
          setSignupError(err);
        });
    }
  };

  // invited user doesn't receive verificationUrl
  const _createInvitedUser = (values, inviteToken) => {
    dispatch(createInvitedUser(values))
      .then((data) => {
        const userData = data.payload;
        dispatch(addTeamMember({ userId: userData.id, inviteToken }))
          .then(() => {
            setLoading(false);
            setAddedToTeam(true);
            setTimeout(() => {
              navigate("/");
            }, 3000);
          });
      })
      .catch(() => {
        setLoading(false);
      });
  };

  return (
    <div>
      <SimpleNavbar />
      <div className="p-4 sm:w-1/2 pt-10 mt-[-50px] sm:mt-[-100px] h-screen flex flex-col justify-center">
        <div className="flex flex-col justify-center w-full">
          <div className="mx-auto max-w-[400px] sm:max-w-[500px] sm:px-10">
            <Row>
              <h1 className={"text-2xl font-bold"}>
                {"Create your Chartbrew account"}
              </h1>
            </Row>
            <Spacer y={4} />

            <form onSubmit={(e) => {
              e.preventDefault();
              submitUser();
            }}>
              <Row>
                <Text>{"Enter your new sign in details"}</Text>
              </Row>
              <Spacer y={2} />
              <Row>
                <Input
                  variant="bordered"
                  startContent={<LuUser />}
                  type="text"
                  placeholder="Enter your name"
                  labelPlacement="outside"
                  onChange={(e) => {
                    setName(e.target.value);
                    setErrors({ ...errors, name: "" });
                  }}
                  value={name}
                  fullWidth
                  size="lg"
                />
              </Row>
              {errors.name && (
                <Row>
                  <Text color={negative}>
                    {"Please enter your name"}
                  </Text>
                </Row>
              )}
              <Spacer y={2} />
              <Row>
                <Input
                  variant="bordered"
                  startContent={<LuMail />}
                  type="email"
                  placeholder="Enter your email"
                  labelPlacement="outside"
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors({ ...errors, email: "" });
                  }}
                  value={email}
                  fullWidth
                  size="lg"
                />
              </Row>
              {errors.email && (
                <Row>
                  <Text className={"text-danger"}>
                    {"Please enter a valid email"}
                  </Text>
                </Row>
              )}
              <Spacer y={2} />
              <Row>
                <Input
                  variant="bordered"
                  startContent={<LuLock />}
                  type="password"
                  placeholder="Enter a secure password"
                  labelPlacement="outside"
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors({ ...errors, password: "" });
                  }}
                  value={password}
                  fullWidth
                  size="lg"
                />
              </Row>
              {errors.password && (
              <Row>
                <Text color={negative}>
                  {errors.password}
                </Text>
              </Row>
              )}
              <Spacer y={4} />
              <Row>
                <Button
                  onClick={submitUser}
                  isLoading={loading}
                  type="submit"
                  size="lg"
                  endContent={<LuArrowRight />}
                  auto
                  color="primary"
                >
                  Continue
                </Button>
              </Row>
              {signupError && (
              <Row>
                <Text b color={negative}>{signupError.message || signupError}</Text>
              </Row>
              )}
              {addedToTeam && (
              <Row>
                <Text color={positive}>
                  {"You created a new account and were added to the team. We will redirect you to your dashboard now..."}
                </Text>
              </Row>
              )}
            </form>

            <Spacer y={4} />
            <Text size="sm">
              {"By signing up for a Chartbrew account, you agree to our "}
              <a href="https://chartbrew.com/legal/terms" rel="noopener noreferrer" target="_blank">Terms of Service</a>
              {" and "}
              <a href="https://chartbrew.com/legal/privacy-policy" rel="noopener noreferrer" target="_blank">Privacy Policy</a>
            </Text>
            <Spacer y={4} />
            <Divider />
            <Spacer y={4} />
            <div>
              <Text size="sm">
                {" "}
                Already have an account?
                {" "}
                <Link to={"/login"} style={styles.loginLink}>Login here</Link>
                {" "}
              </Text>
            </div>

            <Spacer y={8} className="block sm:hidden" />
          </div>
        </div>
      </div>

      <aside className="hidden sm:block fixed top-6 right-0 z-40 w-1/2 h-screen border-l-2 border-solid border-content3" aria-label="Sidebar">
        <div className="h-full px-3 py-4 overflow-y-auto">
          <div style={styles.sideBackground} className="opacity-15 dark:opacity-20 hidden md:block" />
          <Spacer y={8} />
          <div className="flex flex-col justify-center h-full mt-[-50px] sm:mt-[-100px] max-w-[500px] mx-auto">
            <Card className="p-2">
              <CardHeader>
                <Avatar isBordered src={testimonialAvatar} alt="Fairchain testimonial" />
                <div className="grid grid-cols-12 pl-6">
                  <div className="col-span-12">
                    <span className={"text-sm font-medium leading-4"}>
                      Schuyler
                    </span>
                  </div>
                  <div className="col-span-12">
                    <span className="text-gray-500 text-sm flex flex-row">
                      {"Full-stack Developer at "}
                      <Spacer x={1} />
                      <LinkNext className="text-sm" href="https://fairchain.art" rel="noopener noreferrer" target="_blank" color="secondary">
                        {"Fairchain"}
                      </LinkNext>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                <span className="italic text-sm">{"Chartbrew has helped us move away from having to constantly update clunky Google-based charts, but what most impresses me is the responsiveness and the helpfulness of the people behind Chartbrew. Highly recommend!"}</span>
              </CardBody>
            </Card>
            <Spacer y={4} />
            <Card className="p-2">
              <CardHeader>
                <Avatar isBordered src={circularCity} alt="Circular City testimonial" />
                <div className="grid grid-cols-12 pl-6">
                  <div className="col-span-12">
                    <span className={"text-sm font-medium leading-4"}>
                      Debbie Lau
                    </span>
                  </div>
                  <div className="col-span-12">
                    <span className="text-gray-500 text-sm flex flex-row">
                      {"Co-founder, "}
                      <Spacer x={1} />
                      <LinkNext className="text-sm" href="https://www.circularcity.asia/?ref=chartbrew" rel="noopener noreferrer" target="_blank" color="secondary">
                        {"Circular City"}
                      </LinkNext>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                <span className="italic text-sm">{"Chartbrew is definitely a great open-source platform to go to, particularly for a non-technical person like me, for connecting databases and APIs to create beautiful live charts. Strongly recommend."}</span>
              </CardBody>
            </Card>
            <Spacer y={4} />
            <Card className="p-2">
              <CardHeader>
                <Avatar isBordered src={moomken} alt="Moomken testimonial" />
                <div className="grid grid-cols-12 pl-6">
                  <div className="col-span-12">
                    <span className={"text-sm font-medium leading-4"}>
                      Taha Elsherif
                    </span>
                  </div>
                  <div className="col-span-12">
                    <span className="text-gray-500 text-sm flex flex-row">
                      {"IT Manager at "}
                      <Spacer x={1} />
                      <LinkNext className="text-sm" href="https://moomken.org/?ref=chartbrew" rel="noopener noreferrer" target="_blank" color="secondary">
                        {"Moomken"}
                      </LinkNext>
                    </span>
                  </div>
                </div>
              </CardHeader>
              <Divider />
              <CardBody>
                <span className="italic text-sm">{"Chartbrew helped us collect and visualize data from the General Electricity Company Of Libya. It was very easy to set up with the integration of Strapi CMS and we are glad Chartbrew has our backs!"}</span>
              </CardBody>
            </Card>
          </div>
        </div>
      </aside>
    </div>
  );
}

const styles = {
  loginLink: {
    color: secondary,
  },
  sideBackground: {
    backgroundImage: `url(${signupBackground})`,
    backgroundSize: "cover",
    backgroundPosition: "top",
    backgroundRepeat: "no-repeat",
    width: "100%",
    height: "100%",
    transition: "filter 1s ease",
    position: "absolute",
    top: 0,
    right: 0,
  },
  testimonialCard: {
    position: "absolute",
    top: "20%",
    right: "5%",
    width: "40%",
  },
};

const mapStateToProps = (state) => {
  return {
    form: state.forms,
    errors: state.error,
  };
};

const mapDispatchToProps = () => {
  return {
  };
};
export default connect(mapStateToProps, mapDispatchToProps)(Signup);
