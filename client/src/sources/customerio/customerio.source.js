import customerioLogo from "./assets/customerio-light.webp";
import customerioDarkLogo from "./assets/customerio-dark.webp";

const customerioSource = {
  id: "customerio",
  type: "customerio",
  subType: "customerio",
  name: "Customer.io",
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
