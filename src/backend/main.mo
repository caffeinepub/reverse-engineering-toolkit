import Int "mo:core/Int";
import Map "mo:core/Map";
import Text "mo:core/Text";
import Time "mo:core/Time";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";

actor {
  type AnalysisSession = {
    id : Nat;
    filename : Text;
    tool : Text;
    timestamp : Int;
    resultSummary : Text;
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
    };
    sessions.add(id, session);
    nextId += 1;
    id;
  };

  public query ({ caller }) func getSessions() : async [AnalysisSession] {
    sessions.values().toArray();
  };

  public shared ({ caller }) func deleteSession(id : Nat) : async Bool {
    if (sessions.containsKey(id)) {
      sessions.remove(id);
      true;
    } else {
      Runtime.trap("Session does not exist");
    };
  };

  public shared ({ caller }) func clearAllSessions() : async () {
    sessions.clear();
  };
};
