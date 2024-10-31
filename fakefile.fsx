#r "paket:
nuget Fake.Core.Target //"
#r "paket:
nuget Fake.IO.Zip //"
#r "paket:
nuget Fake.IO.Globbing //"
#load "./.fake/fakefile.fsx/intellisense.fsx"

open Fake.Core
open Fake.IO
open Fake.IO.Globbing
open Fake.IO.Globbing.Operators
open Fake.Core.TargetOperators
open Fake.IO.FileSystemOperators

let build_dir = "build"
let front_dir = "knktools-front"

let front_dist = front_dir + "/dist"
let build_static = build_dir + "/static"

let release_zip = "release.zip"

Target.create "Clean" (fun p ->
    Trace.trace " --- Cleaning stuff --- "
    Shell.rm_rf build_dir
    Shell.rm_rf release_zip
)

// Default target
Target.create "BuildFront" (fun _ ->
  let result = CreateProcess.fromRawCommandLine @"C:\Users\AlexG\AppData\Roaming\npm\npm.cmd" "run build"
              |> CreateProcess.withWorkingDirectory "./knktools-front"
              |> Proc.run
  if result.ExitCode <> 0 then
    failwith("error")
)

Target.create "PackageFront" (fun _ ->
  Shell.mkdir build_dir
  Shell.cp_r front_dist build_static
)

Target.create "BuildBack" (fun _ ->
  let result = CreateProcess.fromRawCommandLine @"go" "build -o build/server.exe ."
              |> CreateProcess.withWorkingDirectory "backend"
              |> Proc.run
  if result.ExitCode <> 0 then
    failwith("error")
  Environment.setEnvironVar "GOARCH" "amd64"
  Environment.setEnvironVar "GOOS" "linux"
  let result = CreateProcess.fromRawCommandLine @"go" "build -o build/server ."
              |> CreateProcess.withWorkingDirectory "backend"
              |> Proc.run
  if result.ExitCode <> 0 then
    failwith("error")
)

Target.create "PackageAssets" (fun _ ->
  ()
)

Target.create "PackageDistFiles" (fun _ ->
  let files = !! "dist/**"
  for file in files do
    Shell.cp_r file build_dir
)

Target.create "PackageAll" (fun _ ->
  printfn("Packaging...")
  let pattern = !! (build_dir + "/**")
  Zip.zip  build_dir release_zip pattern |> ignore
)

"Clean"
    ==> "BuildFront"
    ==> "PackageFront"
    ==> "BuildBack"
    ==> "PackageAssets"
    ==> "PackageDistFiles"
    ==> "PackageAll"

// start build
Target.runOrDefault "PackageAll"
