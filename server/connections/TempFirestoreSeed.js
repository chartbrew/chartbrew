const moment = require("moment");

module.exports = async (db, collection) => {
  const docRef = await db.collection(collection);

  // seed
  docRef.doc("client1").set({
    contractId: "2l9gpoF3qlMkbMg1RFxZ",
    updatedAt: moment().subtract(15, "days").format("X"),
    presentations: [{
      id: db.doc("connections/06ORgRNLLpaaTzngnajY"),
      quantity: 24
    }, {
      id: db.doc("connections/5rie2xiynw0h7kue8bxP"),
      quantity: 15
    }, {
      id: db.doc("connections/8S9zOzrBt6RCuKzCAW61"),
      quantity: 5
    }, {
      id: db.doc("connections/FqCY8E5ObI39sI3MtGDQ"),
      quantity: 30
    }],
  });

  docRef.doc("client2").set({
    contractId: "VTE4RjUlXJy32bHWej2g",
    updatedAt: moment().subtract(11, "days").format("X"),
    presentations: [{
      id: db.doc("connections/of5fkX2ZL4sppDbE8D5D"),
      quantity: 4
    }, {
      id: db.doc("connections/zNHmheT2DtJg8DvukC4Q"),
      quantity: 45
    }, {
      id: db.doc("connections/u9DMhJZWPAqMEAvoxIBG"),
      quantity: 55
    }, {
      id: db.doc("connections/IfjrS0YQDwo57hRu04J7"),
      quantity: 3
    }],
  });

  docRef.doc("client3").set({
    contractId: "bAPRFK3NaeV8drMIHTrS",
    updatedAt: moment().subtract(6, "days").format("X"),
    presentations: [{
      id: db.doc("connections/of5fkX2ZL4sppDbE8D5D"),
      quantity: 44
    }, {
      id: db.doc("connections/FqCY8E5ObI39sI3MtGDQ"),
      quantity: 14
    }, {
      id: db.doc("connections/u9DMhJZWPAqMEAvoxIBG"),
      quantity: 17
    }, {
      id: db.doc("connections/06ORgRNLLpaaTzngnajY"),
      quantity: 29
    }],
  });

  docRef.doc("client4").set({
    contractId: "VTE4RjUlXJy32bHWej2g",
    updatedAt: moment().subtract(3, "days").format("X"),
    presentations: [{
      id: db.doc("connections/IfjrS0YQDwo57hRu04J7"),
      quantity: 34
    }, {
      id: db.doc("connections/of5fkX2ZL4sppDbE8D5D"),
      quantity: 24
    }, {
      id: db.doc("connections/u9DMhJZWPAqMEAvoxIBG"),
      quantity: 71
    }, {
      id: db.doc("connections/06ORgRNLLpaaTzngnajY"),
      quantity: 9
    }],
  });
};
