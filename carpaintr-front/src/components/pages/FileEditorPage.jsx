import TopBarUser from '../layout/TopBarUser';
import FilesystemBrowser from '../editor/FilesystemBrowser';

const filesystemConfigs = [
    {
        name: "Common",
        listEndpoint: "editor/list_common_files",
        readEndpoint: "editor/read_common_file",
        uploadEndpoint: "editor/upload_user_file", // Changes to common files create a copy in user directory
        deleteEndpoint: "editor/delete_user_file"  // Deleting common files deletes the user copy
    },
    {
        name: "User",
        listEndpoint: "editor/list_user_files",
        readEndpoint: "editor/read_user_file",
        uploadEndpoint: "editor/upload_user_file",
        deleteEndpoint: "editor/delete_user_file",
        historyEnabled: true
    }
];

const FileEditorPage = () => {
    return <div><TopBarUser /><div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <FilesystemBrowser filesystems={filesystemConfigs} />
    </div>
    </div>
}

export default FileEditorPage