import TopBarUser from '../layout/TopBarUser';
import FileEditor from '../editor/FileEditor';

const FileEditorPage = () => {
    return <div><TopBarUser/><div className='fade-in-simple' style={{ maxWidth: '800px', margin: '0 auto', padding: '1em' }}>
        <FileEditor userCommonSwitch={true} listCommonEndpoint="editor/list_common_files" deleteEndpoint="editor/delete_user_file" listUserEndpoint="editor/list_user_files" readCommonEndpoint="editor/read_common_file" readUserEndpoint="editor/read_user_file" uploadEndpoint="editor/upload_user_file"/></div>
    </div>
}

export default FileEditorPage