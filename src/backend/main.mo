import Int "mo:core/Int";
import Map "mo:core/Map";
import Time "mo:core/Time";
import Array "mo:core/Array";



actor {
  type AnalysisSession = {
    id : Nat;
    filename : Text;
    tool : Text;
    timestamp : Int;
    resultSummary : Text;
    note : Text;
  };

  var nextId = 0;
  let sessions = Map.empty<Nat, AnalysisSession>();

  public shared ({ caller }) func createSession(filename : Text, tool : Text, resultSummary : Text) : async Nat {
    let id = nextId;
    let session : AnalysisSession = {
      id;
      filename;
      tool;
      timestamp = Time.now();
      resultSummary;
      note = "";
    };
    sessions.add(id, session);
    nextId += 1;
    id;
  };

  public query ({ caller }) func getSessions() : async [AnalysisSession] {
    sessions.values().toArray();
  };

  public shared ({ caller }) func deleteSession(id : Nat) : async Bool {
    switch (sessions.get(id)) {
      case (?_) {
        sessions.remove(id);
        true;
      };
      case (null) { false };
    };
  };

  public shared ({ caller }) func clearAllSessions() : async () {
    sessions.clear();
  };

  public shared ({ caller }) func updateSessionNote(id : Nat, note : Text) : async Bool {
    switch (sessions.get(id)) {
      case (?session) {
        let updatedSession = {
          session with note;
        };
        sessions.add(id, updatedSession);
        true;
      };
      case (null) { false };
    };
  };
};
