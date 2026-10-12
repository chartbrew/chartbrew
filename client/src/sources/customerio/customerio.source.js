import customerioLogo from "./assets/logo-light.svg";
import customerioDarkLogo from "./assets/logo-dark.svg";

const customerioSource = {
  id: "customerio",
  type: "customerio",
  subType: "customerio",
  name: "Customer.io",
  description: "Explore customer data and audience segments.",
  category: "marketing",
  capabilities: {
    ai: {
      canGenerateDatasets: true,
      canGenerateQueries: false,
      hasSourceInstructions: true,
      hasTools: true,
    },
  },
  assets: {
    lightLogo: customerioLogo,
    darkLogo: customerioDarkLogo,
  },
};

export default customerioSource;
