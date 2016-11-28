Meteor.startup(function () {
  // insert a document if there isn't one already
  if (!Documents.findOne()){// no documents yet!
      Documents.insert({title:"my new document"});
  }
});

Meteor.publish("documents", function() {
  return Documents.find({
    $or:[
      {isPrivate:{$ne:true}},
      {owner: this.userId}
    ]
  });
});

Meteor.publish("editingUsers", function() {
  return EditingUsers.find();
});
