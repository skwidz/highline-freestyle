import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import ComboDetails from '../combos/ComboDetails';
import { stickFrequencies } from '../../services/enums';
import useLocalStorage from '../hooks/useLocalStorage';

import Database from "../../services/db";
const db = new Database();

const ComboGenerator = ({ difficultyRangeMax, randomCombo, setRandomCombo }) => {

  const navigate = useNavigate();

  const [generatedCombosCount, setGeneratedCombosCount] = useLocalStorage('randomComboCount', 1);

  const [numberOfTricks, setNumberOfTricks] = useState('');
  const [removeTricks, setRemoveTricks] = useState(true);
  const [allowConsecutiveTricks, setConsecutiveTricks] = useState(false);
  const [maxDifficulty, setMaxDifficulty] = useState(difficultyRangeMax);
  const [avgDifficulty, setAvgDifficulty] = useState(-1);
  const [comboName, setComboName] = useState("Random #" + generatedCombosCount);

  const tricks = useLiveQuery(() => db.getAllTricks(), []);
  if (!tricks) return null

  const arePositionsSimilar = (startPos, endPos) => {
    if ((startPos === "KOREAN" && (endPos === "CHEST" || endPos === "BACK")) || (startPos === "CHEST" && endPos === "KOREAN") || (startPos === "BACK" && endPos === "KOREAN") || (startPos === "EXPOSURE" && endPos === "STAND") || (startPos === "STAND" && endPos === "EXPOSURE")) {
      return true;
    } else {
      return false;
    }
  }

  // Contains all diff-levels that should be EXCLUDED from the combo
  const difficultyBlacklist = []
  function refreshBlacklist() {
    difficultyBlacklist.length = 0;
    let childs = document.getElementById("specifyItemsDiv").childNodes
    childs.forEach(element => {
      let box = element.getElementsByTagName("input")[0]
      if (!box.checked) {
        difficultyBlacklist.push(box.value);
      }
    });
    console.log("Current trick level blacklist: " + difficultyBlacklist);
  }

  // If the user wants to save the combo it is added to the database
  const saveToCombos = () => {
    db.saveCombo(randomCombo)
      .then(() => {
        console.log("savedCombo");
      })
      .catch(e => {
        console.log(e);
      });

    // Increment number of generated combos by 1 so all the combos have unique names
    setGeneratedCombosCount(generatedCombosCount + 1);
    setRandomCombo(null);
    navigate("/combos");
  };

  const computeStats = (randomTricks) => {
    let minDiff = Infinity;
    let maxDiff = -Infinity;
    let avgDiff;
    let numberOfTricks = randomTricks.length;
    let totalDiff = 0;
    const currentYear = new Date().getFullYear();

    randomTricks.map(trick => {
      if (trick.difficultyLevel < minDiff) {
        minDiff = parseInt(trick.difficultyLevel);
      }
      if (trick.difficultyLevel > maxDiff) {
        maxDiff = parseInt(trick.difficultyLevel);
      }
      totalDiff += parseInt(trick.difficultyLevel);
    });

    avgDiff = Math.round((totalDiff / numberOfTricks + Number.EPSILON) * 100) / 100;

    setRandomCombo({
      name: comboName,
      tricks: randomTricks,
      minDiff: minDiff,
      maxDiff: maxDiff,
      avgDiff: avgDiff,
      totalDiff: totalDiff,
      numberOfTricks: numberOfTricks,
      stickFrequency: "Never tried",
      establishedBy: "Generator",
      linkToVideo: "",
      comments: "This combo was randomly generated!",
      yearEstablished: currentYear
    });
  }

  const generateCombo = (e) => {
    e.preventDefault();

    setRandomCombo(null);

    if (numberOfTricks < 1) {
      alert("the number of tricks can't be negative or 0");
      return;
    } else if (parseInt(numberOfTricks) === 1) {
      alert("You need more than one trick for a combo!");
      return;
    }

    let randomTricks = new Array(numberOfTricks);
    let myTricks = [...tricks];

    let stuckPos;
    let removedTrick;

    // maximum retries until the generator stops
    let maxRetries = 100;
    let retries = 0;

    // Shuffle array of tricks
    let shuffleTricks = () => myTricks.sort((a, b) => 0.5 - Math.random());
    shuffleTricks();

    // Get the first trick for the random combo
    randomTricks[0] = myTricks[0];
    if (removeTricks) removedTrick = myTricks.shift();

    // Iteratively shuffle array of tricks and find the first trick
    // that has a starting position that matches with the
    // ending position of the trick before
    //
    // If it cant find a continuation it will try again until maxRetries
    for (let i = 1; i < numberOfTricks; i++) {
      if (retries > maxRetries) return alert("couldn't find combo");

      let trickFound = false;
      shuffleTricks();
      let lastPos = randomTricks[i - 1].endPos;
      for (let j = 0; j < myTricks.length; j++) {
        if ((arePositionsSimilar(myTricks[j].startPos, lastPos) || myTricks[j].startPos === lastPos) && (allowConsecutiveTricks || randomTricks[i - 1] !== myTricks[j])) {
          randomTricks[i] = myTricks[j];
          if (removeTricks) removedTrick = myTricks.splice(j, 1);
          trickFound = true;
          console.log("found trick");
          break;
        }
      }
      // if no trick is found the last iteration of the loop is repeated
      // but if it gets stuck on the same position twice, it starts from the begingin
      if (!trickFound) {
        retries++;
        console.log("No suitable trick, from position: " + lastPos + " found, removing last trick");
        if (i === 1 || lastPos === stuckPos) {
          console.log("starting new");
          myTricks = [...tricks];
          shuffleTricks();
          randomTricks[0] = myTricks[0];
          i = 0;
        } else {
          if (removeTricks) myTricks.push(removedTrick);
          i = i - 2;
        }
        stuckPos = lastPos;
      }
    }

    //check integrety of combo
    for (let i = 1; i < randomTricks.length; i++) {
      let prev = randomTricks[i - 1];
      let trick = randomTricks[i];
      if (prev.endPos !== trick.startPos && !arePositionsSimilar(trick.startPos, prev.endPos)) {
        alert("trick generator is broken");
      }
    }

    computeStats(randomTricks);
  }

  function toggleTouch(element) {
    var inp = document.getElementById(element.id);
    inp.classList.toggle("touch-button-active");
    inp.classList.toggle("touch-button-inactive");
  }

  function toggleAvgSlider(checked) {
    var avgDifficultyRange = document.getElementById("avgDifficultyRange");
    avgDifficultyRange.disabled = checked == false;

    refreshAvgSlider();
  }

  function refreshAvgSlider() {
    var avgDifficultyRange = document.getElementById("avgDifficultyRange");
    var checked = document.getElementById("input_chkbx_avg").checked;
    if (!checked) {
      avgDifficultyRange.value = 1;
      setAvgDifficulty(-1);
    } else {
      var halfdiff = maxDifficulty / 2;
      avgDifficultyRange.value = halfdiff;
      setAvgDifficulty(halfdiff);
    }
  }

  return (
    <div className="generator">
      <h2>Generate a Random Combo</h2>
      <form onSubmit={generateCombo}>
        <div className="row form-row">
          <label>Number of Tricks:</label>
          <input
            className="form-control"
            type="number"
            required
            value={numberOfTricks}
            onChange={(e) => setNumberOfTricks(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="maxDifficultyRange" className="form-label">Max difficulty: {maxDifficulty}</label>
          <input type="range" className="form-range" onChange={(e) => { setMaxDifficulty(e.target.value); refreshBlacklist(); refreshAvgSlider(); }} min="1" max={difficultyRangeMax} step="1" id="maxDifficultyRange" />
        </div>
        <div className="form-row">
          <button className="btn btn-secondary" type="button" data-bs-toggle="collapse" data-bs-target="#advancedDifficultyOptions" aria-expanded="false" aria-controls="collapseExample">
            Advanced Options
          </button>

          <div className="collapse" id="advancedDifficultyOptions">
            <div className="card card-body">
              <div className="form-row">

                <p>Allowed difficulty levels:</p>
                <div className="btn-group btn-group-toggle row btn-group-long-row" data-toggle="buttons" id="specifyItemsDiv">
                  {Array.from(Array(parseInt(maxDifficulty)).keys()).map(diffNr => {
                    diffNr++;
                    return (
                      <div className="col-3">
                        <input
                          id={"checkboxForLevel_" + diffNr}
                          value={diffNr}
                          className="btn-check"
                          value={diffNr}
                          type="checkbox"
                          defaultChecked
                          autoComplete="off"
                          onChange={e => refreshBlacklist()} />
                        <label
                          id={"labelForLevel_" + diffNr}
                          className="btn allowedDiffButton touch-button-active"
                          htmlFor={"checkboxForLevel_" + diffNr}
                          onClick={(e) => toggleTouch(e.target)}
                        >{diffNr}</label>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="form-row form-check">
                <label className="form-check-label">Allow duplicates</label>
                <input
                  defaultValue="False"
                  className="form-check-input"
                  type="checkbox"
                  onChange={(e) => setRemoveTricks(e.target.checked == false)}
                />
              </div>
              <div className="form-row form-check">
                <label className="form-check-label">Allow consecutive tricks</label>
                <input
                  defaultValue="False"
                  className="form-check-input"
                  type="checkbox"
                  onChange={(e) => setConsecutiveTricks(e.target.checked)}
                />
              </div>

              <div className="form-row form-check">
                <label className="form-check-label">Average difficulty {avgDifficulty > 0 && avgDifficulty}</label>
                <input
                  id="input_chkbx_avg"
                  defaultValue="False"
                  className="form-check-input"
                  type="checkbox"
                  onClick={(e) => toggleAvgSlider(e.target.checked)}
                />
                <input type="range"
                  disabled
                  className="form-range"
                  onChange={(e) => { setAvgDifficulty(e.target.value); }}
                  min="1"
                  max={maxDifficulty}
                  step="0.5"
                  id="avgDifficultyRange" />
              </div>
            </div>
          </div>
        </div>

        <div className="row justify-content-around">
          <button className="col-sm-4 btn btn-primary">Generate</button>
          {randomCombo && (
            <button className="col-sm-4 btn btn-primary" onClick={saveToCombos}>Add to Combos</button>
          )}
        </div>
      </form>
      <br />
      {randomCombo && <ComboDetails stickFrequencies={stickFrequencies} randomCombo={randomCombo} />}
    </div>
  );
}

export default ComboGenerator;