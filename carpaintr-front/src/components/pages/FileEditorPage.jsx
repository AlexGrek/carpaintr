import TopBarUser from '../layout/TopBarUser';
import FileEditor from '../editor/FileEditor';
import FilesystemBrowser from '../editor/FilesystemBrowser';

const FileEditorPage = () => {
    return <div><TopBarUser/><div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <FilesystemBrowser userCommonSwitch={true} commonFilesEndpoint="editor/list_common_files" deleteEndpoint="editor/delete_user_file" userFilesEndpoint="editor/list_user_files" readCommonEndpoint="editor/read_common_file" readUserEndpoint="editor/read_user_file" uploadEndpoint="editor/upload_user_file"/></div>
    </div>
}

export default FileEditorPage