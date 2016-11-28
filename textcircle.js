// this collection stores all the documents
this.Documents = new Mongo.Collection("documents");
// this collection stores sets of users that are editing documents
EditingUsers = new Mongo.Collection("editingUsers");

if (Meteor.isClient) {
  Meteor.subscribe("documents");
  Meteor.subscribe("editingUsers");

  // return the id of the first document you can find
  Template.editor.helpers({
    docid:function(){
      setupCurrentDocument();
      return Session.get("docid");
    },
    // configure the CodeMirror editor
    config:function(){
      return function(editor){
        editor.setOption("lineNumbers", true);
        editor.setOption("theme", "cobalt");
        // set a callback that gets triggered whenever the user
        // makes a change in the code editing window
        editor.on("change", function(cm_editor, info){
          // send the current code over to the iframe for rendering
          $("#viewer_iframe").contents().find("html").html(cm_editor.getValue());
          Meteor.call("addEditingUser");
        });
      }
    },
  });

  Template.editingUsers.helpers({
    // retrieve a set of users that are editing this document
    users:function(){
      var doc, eusers, users;
      doc = Documents.findOne();
      if (!doc){return;}// give up
      eusers = EditingUsers.findOne({docid:doc._id});
      if (!eusers){return;}// give up
      users = new Array();
      var i = 0;
      for (var user_id in eusers.users){
          users[i] = fixObjectKeys(eusers.users[user_id]);
          i++;
      }
      return users;
    }
  })

  Template.navbar.helpers({
    documents: function() {
      return Documents.find();
    }
  })

  Template.docMeta.helpers({
    document: function() {
      return Documents.findOne({_id:Session.get("docid")});
    },
    canEdit:function() {
      var doc;
      doc = Documents.findOne({_id:Session.get("docid")});
      if(doc) {
        if(doc.owner == Meteor.userId()) {
          return true;
        }
      }
      return false;
    }
  })

  Template.editableText.helpers({
    userCanEdit: function(doc, collection) {
      doc = Documents.findOne({_id:Session.get("docid"), owner:Meteor.userId()});
      if(doc) {
        return true;
      } else {
        return false;
      }
    }
  })

  /////////
  ///EVENTS
  /////////

  Template.navbar.events({
    "click .js-add-doc":function(event){
      event.preventDefault();
      console.log("Add a new doc!");
      if(!Meteor.user()) {
        alert("You need to login first!");
      } else {
        var id = Meteor.call("addDoc", function(err, res) {
          if(!err) {
            console.log("event callback received id " + res);
            Session.set("docid", res);
          }
        });
      }
    },

    "click .js-load-doc":function(event) {
      console.log(this);
      Session.set("docid", this._id);
    }
  })

  Template.docMeta.events({
    "click .js-tog-private": function(event) {
      console.log(event.target.checked);
      var doc = {_id:Session.get("docid"), isPrivate:event.target.checked};
      Meteor.call("updateDocPrivacy", doc);
    }
  })

}// end isClient...

if (Meteor.isServer) {
  Meteor.startup(function () {
    // insert a document if there isn't one already
    if (!Documents.findOne()){// no documents yet!
        Documents.insert({title:"my new document"});
    }
  });

  Meteor.publish("documents", function() {
    return Documents.find({
      $or:[
        {isPrivate:false},
        {owner: this.userId}
      ]
    });
  });

  Meteor.publish("editingUsers", function() {
    return EditingUsers.find();
  });
}
// methods that provide write access to the data
Meteor.methods({
  addDoc:function(){
    var doc;
    if (!this.userId) {
      return;
    } else {
      doc = {
        owner: this.userId,
        createdOn: new Date(),
        title:"my new doc"
      };
      var id = Documents.insert(doc);
      console.log("addDoc method: got an id " + id);
      return id;
    }
  },

  updateDocPrivacy:function(doc){
    console.log(doc);
    var realDoc = Documents.findOne({_id:doc._id, owner:this.userId});
    if(realDoc) {
      realDoc.isPrivate = doc.isPrivate;
      Documents.update({_id:doc._id}, realDoc);
    }
  },
  // allows changes to the editing users collection
  addEditingUser:function(){
    var doc, user, eusers;
    doc = Documents.findOne();
    if (!doc){return;}// no doc give up
    if (!this.userId){return;}// no logged in user give up
    // now I have a doc and possibly a user
    user = Meteor.user().profile;
    eusers = EditingUsers.findOne({docid:doc._id});
    if (!eusers){// no editing users have been stored yet
      eusers = {
        docid:doc._id,
        users:{},
      };
    }
    user.lastEdit = new Date();
    eusers.users[this.userId] = user;
    // upsert- insert or update if filter matches
    EditingUsers.upsert({_id:eusers._id}, eusers);
  }
})

// this renames object keys by removing hyphens to make the compatible
// with spacebars.
function fixObjectKeys(obj){
  var newObj = {};
  for (key in obj){
    var key2 = key.replace("-", "");
    newObj[key2] = obj[key];
  }
  return newObj;
}

function setupCurrentDocument() {
  var doc;
  if(!Session.get("docid")) {
    doc = Documents.findOne();
    if (doc) {
      Session.set("docid", doc._id);
    }
  }
}
